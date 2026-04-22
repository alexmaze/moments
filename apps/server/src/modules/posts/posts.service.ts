import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  forwardRef,
} from '@nestjs/common';
import { eq, and, desc, lt, asc, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import {
  type DrizzleClient,
  posts,
  postMediaRelations,
  postLikes,
  postComments,
  mediaAssets,
  users,
  spaces,
  spaceMembers,
  tags,
  postTags,
} from '@moments/db';
import { parseHashtags, normalizeHashtag, parseMentions } from '@moments/shared';
import { CreatePostDto, UpdatePostDto } from './dto';
import { MentionsService } from '../mentions/mentions.service';
import { UsersService } from '../users/users.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PostsService {
  private readonly COMMENT_PREVIEW_LIMIT = 10;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly mentionsService: MentionsService,
    private readonly mediaService: MediaService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private normalizeAudioDuration(durationMs?: number | null) {
    if (!durationMs || !Number.isFinite(durationMs)) return null;

    const normalized = Math.max(1, Math.round(durationMs));
    if (normalized < 1 || normalized > 120_000) return null;
    return normalized;
  }

  private normalizePostContent(content?: string | null) {
    return content && content.trim().length > 0 ? content.trim() : null;
  }

  private ensurePostHasEditableContent(content: string | null, mediaIds: string[], audioMediaId: string | null) {
    if (!content && mediaIds.length === 0 && !audioMediaId) {
      throw new BadRequestException('Post must have either text content, audio, or at least one media attachment');
    }
  }

  private async replacePostTags(postId: string, content: string | null, tx: any) {
    const postTagRows = await tx
      .select({ tagId: postTags.tagId })
      .from(postTags)
      .where(eq(postTags.postId, postId));

    if (postTagRows.length > 0) {
      await tx.delete(postTags).where(eq(postTags.postId, postId));
      for (const row of postTagRows) {
        await tx
          .update(tags)
          .set({ postCount: sql`${tags.postCount} - 1` })
          .where(eq(tags.id, row.tagId));
      }
    }

    if (!content) return;

    const tagNames = parseHashtags(content);
    for (const tagName of tagNames) {
      const nameLower = normalizeHashtag(tagName);
      const [tag] = await tx
        .insert(tags)
        .values({ name: tagName, nameLower })
        .onConflictDoUpdate({
          target: tags.nameLower,
          set: { postCount: sql`${tags.postCount} + 1` },
        })
        .returning();
      await tx.insert(postTags).values({ postId, tagId: tag.id });
    }
  }

  private async replacePostMentions(postId: string, authorId: string, content: string | null) {
    await this.mentionsService.deleteMentionsForEntity('post', postId);

    if (!content) return;

    const parsedMentions = parseMentions(content);
    if (parsedMentions.length === 0) return;

    await this.mentionsService.createMentions(
      'post',
      postId,
      authorId,
      parsedMentions.map((m) => m.userId),
    );
  }

  async create(dto: CreatePostDto, authorId: string) {
    const normalizedContent = this.normalizePostContent(dto.content);
    const hasContent = !!normalizedContent;
    const hasMedia = dto.mediaIds && dto.mediaIds.length > 0;
    const hasAudio = !!dto.audio;

    this.ensurePostHasEditableContent(normalizedContent, dto.mediaIds ?? [], dto.audio?.mediaId ?? null);

    // If posting to a space, verify membership
    if (dto.spaceId) {
      const [space] = await this.db
        .select({ id: spaces.id, isDeleted: spaces.isDeleted })
        .from(spaces)
        .where(eq(spaces.id, dto.spaceId))
        .limit(1);

      if (!space || space.isDeleted) {
        throw new NotFoundException('Space not found');
      }

      const [membership] = await this.db
        .select({ id: spaceMembers.id })
        .from(spaceMembers)
        .where(and(
          eq(spaceMembers.spaceId, dto.spaceId),
          eq(spaceMembers.userId, authorId),
        ))
        .limit(1);

      if (!membership) {
        throw new ForbiddenException('You must join this space to post');
      }
    }

    const post = await this.db.transaction(async (tx) => {
      // Insert post
      const [newPost] = await tx.insert(posts).values({
        authorId,
        content: normalizedContent,
        spaceId: dto.spaceId ?? null,
        audioMediaId: dto.audio?.mediaId ?? null,
      }).returning();

      // Handle media attachments
      if (hasMedia) {
        // Verify all media belong to the author and are pending
        const ownedMedia = await tx
          .select()
          .from(mediaAssets)
          .where(
            and(
              inArray(mediaAssets.id, dto.mediaIds!),
              eq(mediaAssets.uploaderId, authorId),
              eq(mediaAssets.status, 'pending'),
            ),
          );

        if (ownedMedia.length !== dto.mediaIds!.length) {
          throw new BadRequestException('Some media assets are invalid, not owned by you, or already attached');
        }

        // Insert post-media relations with sort order
        const relations = dto.mediaIds!.map((mediaId, index) => ({
          postId: newPost.id,
          mediaId,
          sortOrder: index,
        }));
        await tx.insert(postMediaRelations).values(relations);

        // Mark media as attached
        await this.mediaService.markAttached(dto.mediaIds!, 'post_attachment', tx);
      }

      if (hasAudio) {
        await this.mediaService.requireOwnedPendingAsset(dto.audio!.mediaId, authorId, 'audio');
        await tx
          .update(mediaAssets)
          .set({ waveform: JSON.stringify(dto.audio!.waveform) })
          .where(eq(mediaAssets.id, dto.audio!.mediaId));
        await this.mediaService.attachAsset(dto.audio!.mediaId, 'post_attachment', tx);
      }

      // Increment space post count
      if (dto.spaceId) {
        await tx
          .update(spaces)
          .set({ postCount: sql`${spaces.postCount} + 1` })
          .where(eq(spaces.id, dto.spaceId));
      }

      await this.replacePostTags(newPost.id, normalizedContent, tx);

      return newPost;
    });

    await this.replacePostMentions(post.id, authorId, normalizedContent);

    const parsedMentions = parseMentions(normalizedContent || '');
    for (const mention of parsedMentions) {
      await this.notificationsService.createMentionInPostNotification(
        post.id,
        mention.userId,
        authorId,
        normalizedContent,
      );
    }

    return this.getById(post.id, authorId);
  }

  async updateOwn(id: string, dto: UpdatePostDto, userId: string) {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(and(eq(posts.id, id), eq(posts.isDeleted, false)))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    const normalizedContent = this.normalizePostContent(dto.content);
    const nextMediaIds = dto.mediaIds ?? [];
    const nextAudioMediaId = dto.audio?.mediaId ?? null;

    this.ensurePostHasEditableContent(normalizedContent, nextMediaIds, nextAudioMediaId);

    const uniqueMediaIds = [...new Set(nextMediaIds)];
    if (uniqueMediaIds.length !== nextMediaIds.length) {
      throw new BadRequestException('Duplicate media assets are not allowed');
    }

    await this.db.transaction(async (tx) => {
      const currentMediaRows = await tx
        .select({ mediaId: postMediaRelations.mediaId })
        .from(postMediaRelations)
        .where(eq(postMediaRelations.postId, id));
      const currentMediaIds = currentMediaRows.map((row: { mediaId: string }) => row.mediaId);
      const currentMediaIdSet = new Set(currentMediaIds);
      const currentAudioMediaId = post.audioMediaId;

      if (uniqueMediaIds.length > 0) {
        const mediaRows = await tx
          .select()
          .from(mediaAssets)
          .where(inArray(mediaAssets.id, uniqueMediaIds));

        if (mediaRows.length !== uniqueMediaIds.length) {
          throw new BadRequestException('Some media assets are invalid');
        }

        for (const asset of mediaRows) {
          if (asset.type === 'audio') {
            throw new BadRequestException('Post attachments cannot include audio assets');
          }

          const isCurrentAttachment = currentMediaIdSet.has(asset.id);
          if (isCurrentAttachment) continue;

          if (asset.uploaderId !== userId || (asset.status !== 'pending' && asset.status !== 'orphaned')) {
            throw new BadRequestException('Some media assets are invalid, not owned by you, or already attached');
          }
        }
      }

      if (nextAudioMediaId && nextAudioMediaId !== currentAudioMediaId) {
        await this.mediaService.requireOwnedPendingAsset(nextAudioMediaId, userId, 'audio');
        await tx
          .update(mediaAssets)
          .set({ waveform: JSON.stringify(dto.audio!.waveform) })
          .where(eq(mediaAssets.id, nextAudioMediaId));
      }

      await tx
        .update(posts)
        .set({
          content: normalizedContent,
          audioMediaId: nextAudioMediaId,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, id));

      await tx.delete(postMediaRelations).where(eq(postMediaRelations.postId, id));
      if (uniqueMediaIds.length > 0) {
        await tx.insert(postMediaRelations).values(
          uniqueMediaIds.map((mediaId, index) => ({
            postId: id,
            mediaId,
            sortOrder: index,
          })),
        );
      }

      const newlyAttachedMediaIds = uniqueMediaIds.filter((mediaId) => !currentMediaIdSet.has(mediaId));
      if (newlyAttachedMediaIds.length > 0) {
        await this.mediaService.markAttached(newlyAttachedMediaIds, 'post_attachment', tx);
      }

      const removedMediaIds = currentMediaIds.filter((mediaId) => !uniqueMediaIds.includes(mediaId));
      for (const mediaId of removedMediaIds) {
        await this.mediaService.markOrphanedIfUnreferenced(mediaId, tx);
      }

      if (nextAudioMediaId && nextAudioMediaId !== currentAudioMediaId) {
        await this.mediaService.attachAsset(nextAudioMediaId, 'post_attachment', tx);
      }

      if (currentAudioMediaId && currentAudioMediaId !== nextAudioMediaId) {
        await this.mediaService.markOrphanedIfUnreferenced(currentAudioMediaId, tx);
      }

      await this.replacePostTags(id, normalizedContent, tx);
    });

    await this.replacePostMentions(id, userId, normalizedContent);

    const parsedMentions = parseMentions(normalizedContent || '');
    for (const mention of parsedMentions) {
      await this.notificationsService.createMentionInPostNotification(
        id,
        mention.userId,
        userId,
        normalizedContent,
      );
    }

    return this.getById(id, userId);
  }

  async uploadAudio(file: Express.Multer.File, _uploaderId: string, clientDurationMs?: number) {
    const asset = await this.mediaService.uploadFile(file, _uploaderId);
    const normalizedClientDuration = this.normalizeAudioDuration(clientDurationMs);
    const finalDurationMs = this.normalizeAudioDuration(asset.durationMs) ?? normalizedClientDuration;

    if (asset.type !== 'audio' || !finalDurationMs) {
      throw new BadRequestException('Audio duration must be between 1 and 120 seconds');
    }

    if (asset.durationMs !== finalDurationMs) {
      await this.db
        .update(mediaAssets)
        .set({ durationMs: finalDurationMs })
        .where(eq(mediaAssets.id, asset.id));
    }

    return {
      id: asset.id,
      type: asset.type,
      publicUrl: asset.publicUrl,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      durationMs: finalDurationMs,
    };
  }

  async getFeed(cursor?: string, limit = 20, currentUserId?: string, tagName?: string) {
    const safeLimit = Math.min(limit, 50);

    const conditions = [eq(posts.isDeleted, false)];
    if (cursor) {
      conditions.push(lt(posts.createdAt, new Date(cursor)));
    }

    let postRows: (typeof posts.$inferSelect)[];

    if (tagName) {
      const nameLower = normalizeHashtag(tagName);
      const rows = await this.db
        .select({ post: posts })
        .from(postTags)
        .innerJoin(tags, eq(postTags.tagId, tags.id))
        .innerJoin(posts, eq(postTags.postId, posts.id))
        .where(and(eq(tags.nameLower, nameLower), ...conditions))
        .orderBy(desc(posts.createdAt))
        .limit(safeLimit + 1);
      postRows = rows.map((r: { post: typeof posts.$inferSelect }) => r.post);
    } else {
      postRows = await this.db
        .select()
        .from(posts)
        .where(and(...conditions))
        .orderBy(desc(posts.createdAt))
        .limit(safeLimit + 1);
    }

    const hasMore = postRows.length > safeLimit;
    const resultPosts = hasMore ? postRows.slice(0, safeLimit) : postRows;

    if (resultPosts.length === 0) {
      return { data: [], meta: { hasMore: false, nextCursor: null } };
    }

    const postIds = resultPosts.map((p) => p.id);
    const data = await this.enrichPosts(resultPosts, postIds, currentUserId);

    const lastPost = resultPosts[resultPosts.length - 1];
    return {
      data,
      meta: {
        hasMore,
        nextCursor: hasMore ? lastPost.createdAt.toISOString() : null,
      },
    };
  }

  async getById(id: string, currentUserId?: string) {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(and(eq(posts.id, id), eq(posts.isDeleted, false)))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const [enriched] = await this.enrichPosts([post], [post.id], currentUserId);
    return enriched;
  }

  async getUserPosts(username: string, cursor?: string, limit = 20, currentUserId?: string) {
    const safeLimit = Math.min(limit, 50);

    // Get user by username
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const conditions = [
      eq(posts.isDeleted, false),
      eq(posts.authorId, user.id),
    ];
    if (cursor) {
      conditions.push(lt(posts.createdAt, new Date(cursor)));
    }

    const postRows = await this.db
      .select()
      .from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(safeLimit + 1);

    const hasMore = postRows.length > safeLimit;
    const resultPosts = hasMore ? postRows.slice(0, safeLimit) : postRows;

    if (resultPosts.length === 0) {
      return { data: [], meta: { hasMore: false, nextCursor: null } };
    }

    const postIds = resultPosts.map((p) => p.id);
    const data = await this.enrichPosts(resultPosts, postIds, currentUserId);

    const lastPost = resultPosts[resultPosts.length - 1];
    return {
      data,
      meta: {
        hasMore,
        nextCursor: hasMore ? lastPost.createdAt.toISOString() : null,
      },
    };
  }

  async deleteOwn(id: string, userId: string) {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.db.transaction(async (tx) => {
      const attachedMediaIds = await tx
        .select({ mediaId: postMediaRelations.mediaId })
        .from(postMediaRelations)
        .where(eq(postMediaRelations.postId, id));

      await tx
        .update(posts)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(eq(posts.id, id));

      if (post.spaceId) {
        await tx
          .update(spaces)
          .set({ postCount: sql`${spaces.postCount} - 1` })
          .where(eq(spaces.id, post.spaceId));
      }

      const postTagRows = await tx
        .select({ tagId: postTags.tagId })
        .from(postTags)
        .where(eq(postTags.postId, id));

      if (postTagRows.length > 0) {
        await tx.delete(postTags).where(eq(postTags.postId, id));
        for (const row of postTagRows) {
          await tx
            .update(tags)
            .set({ postCount: sql`${tags.postCount} - 1` })
          .where(eq(tags.id, row.tagId));
        }
      }

      if (attachedMediaIds.length > 0) {
        await tx.delete(postMediaRelations).where(eq(postMediaRelations.postId, id));
        for (const { mediaId } of attachedMediaIds) {
          await this.mediaService.markOrphanedIfUnreferenced(mediaId, tx);
        }
      }

      if (post.audioMediaId) {
        await this.mediaService.markOrphanedIfUnreferenced(post.audioMediaId, tx);
      }
    });

    await this.mentionsService.deleteMentionsForEntity('post', id);

    return { success: true };
  }

  async getSpacePosts(spaceId: string, cursor?: string, limit = 20, currentUserId?: string) {
    const safeLimit = Math.min(limit, 50);

    const conditions = [eq(posts.isDeleted, false), eq(posts.spaceId, spaceId)];
    if (cursor) {
      conditions.push(lt(posts.createdAt, new Date(cursor)));
    }

    const postRows = await this.db
      .select()
      .from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(safeLimit + 1);

    const hasMore = postRows.length > safeLimit;
    const resultPosts = hasMore ? postRows.slice(0, safeLimit) : postRows;

    if (resultPosts.length === 0) {
      return { data: [], meta: { hasMore: false, nextCursor: null } };
    }

    const postIds = resultPosts.map((p) => p.id);
    const data = await this.enrichPosts(resultPosts, postIds, currentUserId);

    const lastPost = resultPosts[resultPosts.length - 1];
    return {
      data,
      meta: {
        hasMore,
        nextCursor: hasMore ? lastPost.createdAt.toISOString() : null,
      },
    };
  }

  // Batch-load related data for a list of posts
  private async enrichPosts(
    postRows: (typeof posts.$inferSelect)[],
    postIds: string[],
    currentUserId?: string,
  ) {
    // Batch load authors
    const authorIds = [...new Set(postRows.map((p) => p.authorId))];
    const authorRows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: mediaAssets.publicUrl,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(inArray(users.id, authorIds));
    const authorMap = new Map(authorRows.map((a) => [a.id, a]));

    // Batch load media
    const mediaRelRows = await this.db
      .select()
      .from(postMediaRelations)
      .innerJoin(mediaAssets, eq(postMediaRelations.mediaId, mediaAssets.id))
      .where(inArray(postMediaRelations.postId, postIds))
      .orderBy(postMediaRelations.sortOrder);

    const mediaByPost = new Map<string, typeof mediaRelRows>();
    for (const row of mediaRelRows) {
      const list = mediaByPost.get(row.post_media_relations.postId) || [];
      list.push(row);
      mediaByPost.set(row.post_media_relations.postId, list);
    }

    const audioMediaIds = [...new Set(postRows.map((p) => p.audioMediaId).filter(Boolean))] as string[];
    let audioAssetMap = new Map<string, typeof mediaAssets.$inferSelect>();
    if (audioMediaIds.length > 0) {
      const audioAssetRows = await this.db
        .select()
        .from(mediaAssets)
        .where(inArray(mediaAssets.id, audioMediaIds));
      audioAssetMap = new Map(audioAssetRows.map((asset) => [asset.id, asset]));
    }

    // Batch load likes for current user
    let likedPostIds = new Set<string>();
    if (currentUserId) {
      const likeRows = await this.db
        .select({ postId: postLikes.postId })
        .from(postLikes)
        .where(
          and(
            inArray(postLikes.postId, postIds),
            eq(postLikes.userId, currentUserId),
          ),
        );
      likedPostIds = new Set(likeRows.map((l) => l.postId));
    }

    // Batch load comment previews (first N comments per post)
    const commentPreviewMap = await this.batchFetchCommentPreviews(
      postIds,
      new Map(postRows.filter(p => p.spaceId).map(p => [p.id, p.spaceId!])),
    );

    // Batch load space info for posts that belong to a space
    const spaceIds = [...new Set(postRows.map((p) => p.spaceId).filter(Boolean))] as string[];
    let spaceMap = new Map<string, { id: string; name: string; slug: string; type: string; babyBirthday: string | null }>();
    let memberSpaceIds = new Set<string>();

    if (spaceIds.length > 0) {
      const spaceRows = await this.db
        .select({
          id: spaces.id,
          name: spaces.name,
          slug: spaces.slug,
          type: spaces.type,
          babyBirthday: spaces.babyBirthday,
          isDeleted: spaces.isDeleted,
        })
        .from(spaces)
        .where(inArray(spaces.id, spaceIds));

      spaceMap = new Map(
        spaceRows
          .filter((s) => !s.isDeleted)
          .map((s) => [s.id, { id: s.id, name: s.name, slug: s.slug, type: s.type, babyBirthday: s.babyBirthday }]),
      );

      if (currentUserId) {
        const membershipRows = await this.db
          .select({ spaceId: spaceMembers.spaceId })
          .from(spaceMembers)
          .where(and(
            inArray(spaceMembers.spaceId, spaceIds),
            eq(spaceMembers.userId, currentUserId),
          ));
        memberSpaceIds = new Set(membershipRows.map((r) => r.spaceId));
      }
    }

    const authorSpaceNicknames = new Map<string, string | null>();
    if (spaceIds.length > 0) {
      const spaceAuthorPairs = postRows
        .filter((p) => p.spaceId)
        .map((p) => ({ spaceId: p.spaceId!, authorId: p.authorId }));
      
      const uniquePairs = [...new Map(spaceAuthorPairs.map(p => [`${p.spaceId}:${p.authorId}`, p])).values()];
      
      if (uniquePairs.length > 0) {
        const nicknameRows = await this.db
          .select({
            spaceId: spaceMembers.spaceId,
            userId: spaceMembers.userId,
            spaceNickname: spaceMembers.spaceNickname,
          })
          .from(spaceMembers)
          .where(
            and(
              inArray(spaceMembers.spaceId, uniquePairs.map(p => p.spaceId)),
              inArray(spaceMembers.userId, uniquePairs.map(p => p.authorId)),
            ),
          );

        for (const row of nicknameRows) {
          authorSpaceNicknames.set(`${row.spaceId}:${row.userId}`, row.spaceNickname);
        }
      }
    }

    const postTagRows = await this.db
      .select({ postId: postTags.postId, tagName: tags.name })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(inArray(postTags.postId, postIds));

    const tagsByPost = new Map<string, string[]>();
    for (const row of postTagRows) {
      const list = tagsByPost.get(row.postId) || [];
      list.push(row.tagName);
      tagsByPost.set(row.postId, list);
    }

    const allMentionedUserIds = new Set<string>();
    for (const post of postRows) {
      if (post.content) {
        const parsed = parseMentions(post.content);
        for (const m of parsed) {
          allMentionedUserIds.add(m.userId);
        }
      }
    }

    let mentionsUserMap = new Map<string, { id: string; username: string; displayName: string; avatarUrl: string | null; spaceNickname?: string | null }>();
    if (allMentionedUserIds.size > 0) {
      const mentionUsers = await this.usersService.findByIds([...allMentionedUserIds]);
      for (const u of mentionUsers) {
        mentionsUserMap.set(u.id, u);
      }
    }

    const mentionSpaceNicknames = new Map<string, string | null>();
    if (spaceIds.length > 0 && allMentionedUserIds.size > 0) {
      const mentionNicknameRows = await this.db
        .select({
          spaceId: spaceMembers.spaceId,
          userId: spaceMembers.userId,
          spaceNickname: spaceMembers.spaceNickname,
        })
        .from(spaceMembers)
        .where(
          and(
            inArray(spaceMembers.spaceId, spaceIds),
            inArray(spaceMembers.userId, [...allMentionedUserIds]),
          ),
        );

      for (const row of mentionNicknameRows) {
        mentionSpaceNicknames.set(`${row.spaceId}:${row.userId}`, row.spaceNickname);
      }
    }

    return postRows.map((post) => {
      const author = authorMap.get(post.authorId)!;
      const mediaRels = mediaByPost.get(post.id) || [];
      const previewComments = commentPreviewMap.get(post.id) || [];
      const spaceInfo = post.spaceId ? spaceMap.get(post.spaceId) ?? null : null;
      const postTagsList = tagsByPost.get(post.id) || [];
      const authorNickname = post.spaceId ? authorSpaceNicknames.get(`${post.spaceId}:${post.authorId}`) ?? null : null;

      const postMentions: { id: string; username: string; displayName: string; avatarUrl: string | null; spaceNickname: string | null }[] = [];
      if (post.content) {
        const parsed = parseMentions(post.content);
        const seen = new Set<string>();
        for (const m of parsed) {
          if (!seen.has(m.userId)) {
            seen.add(m.userId);
            const user = mentionsUserMap.get(m.userId);
            if (user) {
              const mentionNickname = post.spaceId ? mentionSpaceNicknames.get(`${post.spaceId}:${m.userId}`) ?? null : null;
              postMentions.push({ ...user, spaceNickname: mentionNickname });
            }
          }
        }
      }

      return {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        author: {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
          spaceNickname: authorNickname,
        },
        media: mediaRels.map((r) => ({
          id: r.media_assets.id,
          type: r.media_assets.type,
          publicUrl: r.media_assets.publicUrl,
          coverUrl: r.media_assets.coverUrl,
          mimeType: r.media_assets.mimeType,
          width: r.media_assets.width,
          height: r.media_assets.height,
          durationMs: r.media_assets.durationMs,
          sortOrder: r.post_media_relations.sortOrder,
        })),
        audio: post.audioMediaId && audioAssetMap.get(post.audioMediaId) ? {
          id: audioAssetMap.get(post.audioMediaId)!.id,
          url: audioAssetMap.get(post.audioMediaId)!.publicUrl,
          durationMs: audioAssetMap.get(post.audioMediaId)!.durationMs ?? 0,
          waveform: this.parseWaveform(audioAssetMap.get(post.audioMediaId)!.waveform),
          status: 'ready' as const,
          mimeType: audioAssetMap.get(post.audioMediaId)!.mimeType,
          sizeBytes: audioAssetMap.get(post.audioMediaId)!.sizeBytes,
        } : null,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        isLikedByMe: likedPostIds.has(post.id),
        space: spaceInfo ? {
          ...spaceInfo,
          babyBirthday: spaceInfo.babyBirthday,
          isMember: memberSpaceIds.has(spaceInfo.id),
        } : null,
        comments: previewComments,
        hasMoreComments: post.commentCount > previewComments.length,
        tags: postTagsList,
        mentions: postMentions,
      };
    });
  }

  private parseWaveform(raw: string | null) {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
          .map((value) => Math.max(0, Math.min(100, Math.round(value))));
      }
    } catch {
      // Ignore invalid waveform payloads in old rows.
    }

    return [];
  }

  /**
   * Batch-load the first COMMENT_PREVIEW_LIMIT comments for each post.
   * Fetches all non-deleted comments for the given postIds in one query,
   * then groups and truncates in JS (avoids ROW_NUMBER which Drizzle ORM
   * doesn't natively support).
   */
  private async batchFetchCommentPreviews(
    postIds: string[],
    postSpaceIdMap: Map<string, string> = new Map(),
  ) {
    const result = new Map<string, Array<{
      id: string;
      content: string;
      createdAt: string;
      isDeleted: boolean;
      author: { id: string; username: string; displayName: string; avatarUrl: string | null; spaceNickname: string | null };
      replyTo: null;
      mentions: { id: string; username: string; displayName: string; avatarUrl: string | null; spaceNickname: string | null }[];
    }>>();

    if (postIds.length === 0) return result;

    for (const id of postIds) {
      result.set(id, []);
    }

    const rows = await this.db
      .select({
        id: postComments.id,
        postId: postComments.postId,
        content: postComments.content,
        createdAt: postComments.createdAt,
        isDeleted: postComments.isDeleted,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: mediaAssets.publicUrl,
        },
      })
      .from(postComments)
      .innerJoin(users, eq(postComments.authorId, users.id))
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(
        and(
          inArray(postComments.postId, postIds),
          eq(postComments.isDeleted, false),
        ),
      )
      .orderBy(asc(postComments.createdAt));

    const allMentionedUserIds = new Set<string>();
    for (const row of rows) {
      for (const m of parseMentions(row.content)) allMentionedUserIds.add(m.userId);
    }

    const mentionUserMap = new Map<string, { id: string; username: string; displayName: string; avatarUrl: string | null }>();
    if (allMentionedUserIds.size > 0) {
      const mentionUsers = await this.usersService.findByIds([...allMentionedUserIds]);
      for (const u of mentionUsers) mentionUserMap.set(u.id, u);
    }

    const commentAuthorIds = [...new Set(rows.map(r => r.author.id))];
    const commentNicknameMap = new Map<string, string | null>();
    const relevantSpaceIds = [...new Set([...postSpaceIdMap.values()])];

    if (relevantSpaceIds.length > 0 && commentAuthorIds.length > 0) {
      const nicknameRows = await this.db
        .select({
          spaceId: spaceMembers.spaceId,
          userId: spaceMembers.userId,
          spaceNickname: spaceMembers.spaceNickname,
        })
        .from(spaceMembers)
        .where(
          and(
            inArray(spaceMembers.spaceId, relevantSpaceIds),
            inArray(spaceMembers.userId, commentAuthorIds),
          ),
        );

      for (const row of nicknameRows) {
        commentNicknameMap.set(`${row.spaceId}:${row.userId}`, row.spaceNickname);
      }
    }

    const mentionNicknameMap = new Map<string, string | null>();
    if (relevantSpaceIds.length > 0 && allMentionedUserIds.size > 0) {
      const mentionNicknameRows = await this.db
        .select({
          spaceId: spaceMembers.spaceId,
          userId: spaceMembers.userId,
          spaceNickname: spaceMembers.spaceNickname,
        })
        .from(spaceMembers)
        .where(
          and(
            inArray(spaceMembers.spaceId, relevantSpaceIds),
            inArray(spaceMembers.userId, [...allMentionedUserIds]),
          ),
        );

      for (const row of mentionNicknameRows) {
        mentionNicknameMap.set(`${row.spaceId}:${row.userId}`, row.spaceNickname);
      }
    }

    for (const row of rows) {
      const list = result.get(row.postId)!;
      if (list.length < this.COMMENT_PREVIEW_LIMIT) {
        const parsed = parseMentions(row.content);
        const seen = new Set<string>();
        const mentions: { id: string; username: string; displayName: string; avatarUrl: string | null; spaceNickname: string | null }[] = [];
        const postSpaceId = postSpaceIdMap.get(row.postId);

        for (const m of parsed) {
          if (!seen.has(m.userId)) {
            seen.add(m.userId);
            const user = mentionUserMap.get(m.userId);
            if (user) {
              const mentionNickname = postSpaceId
                ? mentionNicknameMap.get(`${postSpaceId}:${m.userId}`) ?? null
                : null;
              mentions.push({ ...user, spaceNickname: mentionNickname });
            }
          }
        }

        const authorNickname = postSpaceId
          ? commentNicknameMap.get(`${postSpaceId}:${row.author.id}`) ?? null
          : null;

        list.push({
          id: row.id,
          content: row.content,
          createdAt: row.createdAt.toISOString(),
          isDeleted: row.isDeleted,
          author: { ...row.author, spaceNickname: authorNickname },
          replyTo: null,
          mentions,
        });
      }
    }

    return result;
  }
}
