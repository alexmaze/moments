import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, lt, and, inArray, ilike, asc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import {
  type DrizzleClient,
  tags,
  postTags,
  posts,
  postMediaRelations,
  mediaAssets,
  users,
  postLikes,
  postComments,
  spaces,
  spaceMembers,
} from '@moments/db';
import { parseHashtags, normalizeHashtag } from '@moments/shared';

@Injectable()
export class TagsService {
  private readonly COMMENT_PREVIEW_LIMIT = 10;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
  ) {}

  async getTags(query?: string, limit = 10) {
    const safeLimit = Math.min(limit, 50);

    const conditions = query
      ? ilike(tags.nameLower, `${normalizeHashtag(query)}%`)
      : undefined;

    const rows = await this.db
      .select()
      .from(tags)
      .where(conditions)
      .orderBy(desc(tags.postCount))
      .limit(safeLimit);

    return {
      data: rows.map(row => ({
        id: row.id,
        name: row.name,
        postCount: row.postCount,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async getTagPosts(
    tagName: string,
    cursor?: string,
    limit = 20,
    sort: 'latest' | 'hot' = 'latest',
    currentUserId?: string,
  ) {
    const safeLimit = Math.min(limit, 50);
    const nameLower = normalizeHashtag(tagName);

    const [tag] = await this.db
      .select()
      .from(tags)
      .where(eq(tags.nameLower, nameLower))
      .limit(1);

    if (!tag) {
      return {
        tag: null,
        posts: { data: [], meta: { hasMore: false, nextCursor: null } },
      };
    }

    const conditions = [
      eq(posts.isDeleted, false),
      eq(postTags.tagId, tag.id),
    ];
    if (cursor) {
      conditions.push(lt(posts.createdAt, new Date(cursor)));
    }

    const orderBy = sort === 'hot'
      ? [desc(sql`${posts.likeCount} + ${posts.commentCount}`), desc(posts.createdAt)]
      : [desc(posts.createdAt)];

    const postRows = await this.db
      .select({ post: posts })
      .from(postTags)
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(safeLimit + 1);

    const hasMore = postRows.length > safeLimit;
    const resultPosts = hasMore ? postRows.slice(0, safeLimit) : postRows;

    if (resultPosts.length === 0) {
      return {
        tag: { id: tag.id, name: tag.name, postCount: tag.postCount },
        posts: { data: [], meta: { hasMore: false, nextCursor: null } },
      };
    }

    const postIds = resultPosts.map((r: { post: typeof posts.$inferSelect }) => r.post.id);
    const enrichedPosts = await this.enrichTagPosts(
      resultPosts.map((r: { post: typeof posts.$inferSelect }) => r.post),
      postIds,
      currentUserId,
    );

    const lastPost = resultPosts[resultPosts.length - 1];
    return {
      tag: { id: tag.id, name: tag.name, postCount: tag.postCount },
      posts: {
        data: enrichedPosts,
        meta: {
          hasMore,
          nextCursor: hasMore ? lastPost.post.createdAt.toISOString() : null,
        },
      },
    };
  }

  async linkPostTags(postId: string, content: string, tx: any) {
    const tagNames = parseHashtags(content);
    if (tagNames.length === 0) return;

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

  async unlinkPostTags(postId: string, tx: any) {
    const postTagRows = await tx
      .select({ tagId: postTags.tagId })
      .from(postTags)
      .where(eq(postTags.postId, postId));

    if (postTagRows.length === 0) return;

    const tagIds = postTagRows.map((r: { tagId: string }) => r.tagId);
    await tx.delete(postTags).where(eq(postTags.postId, postId));

    for (const tagId of tagIds) {
      await tx
        .update(tags)
        .set({ postCount: sql`${tags.postCount} - 1` })
        .where(eq(tags.id, tagId));
    }
  }

  private async enrichTagPosts(
    postRows: (typeof posts.$inferSelect)[],
    postIds: string[],
    currentUserId?: string,
  ) {
    const authorIds = [...new Set(postRows.map(p => p.authorId))];
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
    const authorMap = new Map(authorRows.map(a => [a.id, a]));

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

    let likedPostIds = new Set<string>();
    if (currentUserId) {
      const likeRows = await this.db
        .select({ postId: postLikes.postId })
        .from(postLikes)
        .where(and(inArray(postLikes.postId, postIds), eq(postLikes.userId, currentUserId)));
      likedPostIds = new Set(likeRows.map(l => l.postId));
    }

    const commentPreviewMap = await this.batchFetchCommentPreviews(postIds);

    const spaceIds = [...new Set(postRows.map(p => p.spaceId).filter(Boolean))] as string[];
    let spaceMap = new Map<string, { id: string; name: string; slug: string; type: string }>();
    let memberSpaceIds = new Set<string>();

    if (spaceIds.length > 0) {
      const spaceRows = await this.db
        .select({
          id: spaces.id,
          name: spaces.name,
          slug: spaces.slug,
          type: spaces.type,
          isDeleted: spaces.isDeleted,
        })
        .from(spaces)
        .where(inArray(spaces.id, spaceIds));

      spaceMap = new Map(
        spaceRows
          .filter(s => !s.isDeleted)
          .map(s => [s.id, { id: s.id, name: s.name, slug: s.slug, type: s.type }]),
      );

      if (currentUserId) {
        const membershipRows = await this.db
          .select({ spaceId: spaceMembers.spaceId })
          .from(spaceMembers)
          .where(and(inArray(spaceMembers.spaceId, spaceIds), eq(spaceMembers.userId, currentUserId)));
        memberSpaceIds = new Set(membershipRows.map(r => r.spaceId));
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

    return postRows.map(post => {
      const author = authorMap.get(post.authorId)!;
      const mediaRels = mediaByPost.get(post.id) || [];
      const previewComments = commentPreviewMap.get(post.id) || [];
      const spaceInfo = post.spaceId ? spaceMap.get(post.spaceId) ?? null : null;
      const postTagsList = tagsByPost.get(post.id) || [];

      return {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        author: {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
        },
        media: mediaRels.map(r => ({
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
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        isLikedByMe: likedPostIds.has(post.id),
        space: spaceInfo ? { ...spaceInfo, isMember: memberSpaceIds.has(spaceInfo.id) } : null,
        comments: previewComments,
        hasMoreComments: post.commentCount > previewComments.length,
        tags: postTagsList,
      };
    });
  }

  private async batchFetchCommentPreviews(postIds: string[]) {
    const result = new Map<string, Array<{
      id: string;
      content: string;
      createdAt: string;
      isDeleted: boolean;
      author: { id: string; username: string; displayName: string; avatarUrl: string | null };
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
      .where(and(inArray(postComments.postId, postIds), eq(postComments.isDeleted, false)))
      .orderBy(asc(postComments.createdAt));

    for (const row of rows) {
      const list = result.get(row.postId)!;
      if (list.length < this.COMMENT_PREVIEW_LIMIT) {
        list.push({
          id: row.id,
          content: row.content,
          createdAt: row.createdAt.toISOString(),
          isDeleted: row.isDeleted,
          author: row.author,
        });
      }
    }

    return result;
  }
}
