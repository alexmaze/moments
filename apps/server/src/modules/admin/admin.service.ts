import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import {
  type DrizzleClient,
  systemSettings,
  users,
  posts,
  postComments,
  postLikes,
  postMediaRelations,
  mediaAssets,
  spaces,
  spaceMembers,
} from '@moments/db';
import { parseMentions } from '@moments/shared';
import { MediaService } from '../media/media.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly mediaService: MediaService,
    private readonly usersService: UsersService,
  ) {}

  // --- System Settings ---

  async getSetting(key: string): Promise<string | null> {
    const [row] = await this.db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db
      .insert(systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  async isRegistrationOpen(): Promise<boolean> {
    const value = await this.getSetting('registration_open');
    return value !== 'false';
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const rows = await this.db.select().from(systemSettings);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  // --- User Management ---

  async listUsers(params: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }) {
    const { page, pageSize, search, isActive } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (search) {
      conditions.push(
        sql`(${users.username} ILIKE ${'%' + search + '%'} OR ${users.displayName} ILIKE ${'%' + search + '%'})`,
      );
    }
    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(whereClause);

    const rows = await this.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(sql`${users.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset);

    return {
      items: rows.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: null,
        bio: u.bio,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      })),
      total: countResult.count,
      page,
      pageSize,
    };
  }

  async banUser(userId: string): Promise<void> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async unbanUser(userId: string): Promise<void> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.db
      .update(users)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // --- Post Management ---

  async listPosts(params: {
    page: number;
    pageSize: number;
    authorId?: string;
    search?: string;
  }) {
    const { page, pageSize, authorId, search } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(posts.isDeleted, false)];
    if (authorId) {
      conditions.push(eq(posts.authorId, authorId));
    }
    if (search) {
      conditions.push(sql`${posts.content} ILIKE ${'%' + search + '%'}`);
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(...conditions));

    const postRows = await this.db
      .select()
      .from(posts)
      .where(and(...conditions))
      .orderBy(sql`${posts.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset);

    const postIds = postRows.map((p) => p.id);
    const items = postIds.length > 0
      ? await this.enrichPostsForAdmin(postRows, postIds)
      : [];

    return {
      items,
      total: countResult.count,
      page,
      pageSize,
    };
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
    } catch {}
    return [];
  }

  private async enrichPostsForAdmin(
    postRows: (typeof posts.$inferSelect)[],
    postIds: string[],
  ) {
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

    const commentPreviewMap = await this.batchFetchCommentPreviews(postIds);

    const spaceIds = [...new Set(postRows.map((p) => p.spaceId).filter(Boolean))] as string[];
    let spaceMap = new Map<string, { id: string; name: string; slug: string; type: string; babyBirthday: string | null }>();

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

    const allMentionedUserIds = new Set<string>();
    for (const post of postRows) {
      if (post.content) {
        const parsed = parseMentions(post.content);
        for (const m of parsed) allMentionedUserIds.add(m.userId);
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
        isLikedByMe: false,
        space: spaceInfo ? {
          ...spaceInfo,
          babyBirthday: spaceInfo.babyBirthday,
          isMember: false,
        } : null,
        comments: previewComments,
        hasMoreComments: post.commentCount > previewComments.length,
        tags: [] as string[],
        mentions: postMentions,
      };
    });
  }

  private async batchFetchCommentPreviews(postIds: string[]) {
    const COMMENT_PREVIEW_LIMIT = 10;
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
    for (const id of postIds) result.set(id, []);

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
      .orderBy(postComments.createdAt);

    for (const row of rows) {
      const list = result.get(row.postId)!;
      if (list.length < COMMENT_PREVIEW_LIMIT) {
        list.push({
          id: row.id,
          content: row.content,
          createdAt: row.createdAt.toISOString(),
          isDeleted: row.isDeleted,
          author: { ...row.author, spaceNickname: null },
          replyTo: null,
          mentions: [],
        });
      }
    }

    return result;
  }

  async forceDeletePost(postId: string): Promise<void> {
    const [post] = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.db
      .update(posts)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(posts.id, postId));
  }

  // --- Statistics ---

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      [userCount],
      [todayUserCount],
      [postCount],
      [todayPostCount],
      [commentCount],
      [likeCount],
      [storageResult],
    ] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` }).from(users),
      this.db.select({ count: sql<number>`count(*)::int` }).from(users).where(sql`${users.createdAt} >= ${today}`),
      this.db.select({ count: sql<number>`count(*)::int` }).from(posts).where(eq(posts.isDeleted, false)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(posts).where(and(eq(posts.isDeleted, false), sql`${posts.createdAt} >= ${today}`)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(postComments).where(eq(postComments.isDeleted, false)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(postLikes),
      this.db.select({ totalSize: sql<string>`coalesce(sum(size_bytes), 0)::text` }).from(mediaAssets),
    ]);

    const [dbSizeResult] = await this.db
      .select({ dbSize: sql<string>`pg_database_size(current_database())::text` })
      .from(sql`(SELECT 1) as _`);

    return {
      users: { total: userCount.count, today: todayUserCount.count },
      posts: { total: postCount.count, today: todayPostCount.count },
      comments: { total: commentCount.count },
      likes: { total: likeCount.count },
      storage: { totalBytes: Number(storageResult.totalSize) },
      database: { totalBytes: Number(dbSizeResult.dbSize) },
    };
  }
}
