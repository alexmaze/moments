import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, desc, lt, asc, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import {
  type DrizzleClient,
  posts,
  postMediaRelations,
  postLikes,
  postComments,
  mediaAssets,
  users,
} from '@moments/db';
import { CreatePostDto } from './dto';

@Injectable()
export class PostsService {
  private readonly COMMENT_PREVIEW_LIMIT = 10;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
  ) {}

  async create(dto: CreatePostDto, authorId: string) {
    const hasContent = dto.content && dto.content.trim().length > 0;
    const hasMedia = dto.mediaIds && dto.mediaIds.length > 0;

    if (!hasContent && !hasMedia) {
      throw new BadRequestException('Post must have either text content or at least one media attachment');
    }

    const post = await this.db.transaction(async (tx) => {
      // Insert post
      const [newPost] = await tx.insert(posts).values({
        authorId,
        content: hasContent ? dto.content!.trim() : null,
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
        await tx
          .update(mediaAssets)
          .set({ status: 'attached' })
          .where(inArray(mediaAssets.id, dto.mediaIds!));
      }

      return newPost;
    });

    return this.getById(post.id, authorId);
  }

  async getFeed(cursor?: string, limit = 20, currentUserId?: string) {
    const safeLimit = Math.min(limit, 50);

    // Build conditions
    const conditions = [eq(posts.isDeleted, false)];
    if (cursor) {
      conditions.push(lt(posts.createdAt, new Date(cursor)));
    }

    // Query posts
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

    await this.db
      .update(posts)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(posts.id, id));

    return { success: true };
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
      .select()
      .from(users)
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
    const commentPreviewMap = await this.batchFetchCommentPreviews(postIds);

    // Assemble
    return postRows.map((post) => {
      const author = authorMap.get(post.authorId)!;
      const mediaRels = mediaByPost.get(post.id) || [];
      const previewComments = commentPreviewMap.get(post.id) || [];

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
        media: mediaRels.map((r) => ({
          id: r.media_assets.id,
          type: r.media_assets.type,
          publicUrl: r.media_assets.publicUrl,
          coverUrl: r.media_assets.coverUrl,
          mimeType: r.media_assets.mimeType,
          width: r.media_assets.width,
          height: r.media_assets.height,
          durationSecs: r.media_assets.durationSecs,
          sortOrder: r.post_media_relations.sortOrder,
        })),
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        isLikedByMe: likedPostIds.has(post.id),
        comments: previewComments,
        hasMoreComments: post.commentCount > previewComments.length,
      };
    });
  }

  /**
   * Batch-load the first COMMENT_PREVIEW_LIMIT comments for each post.
   * Fetches all non-deleted comments for the given postIds in one query,
   * then groups and truncates in JS (avoids ROW_NUMBER which Drizzle ORM
   * doesn't natively support).
   */
  private async batchFetchCommentPreviews(postIds: string[]) {
    const result = new Map<string, Array<{
      id: string;
      content: string;
      createdAt: string;
      isDeleted: boolean;
      author: { id: string; username: string; displayName: string; avatarUrl: string | null };
    }>>();

    if (postIds.length === 0) return result;

    // Initialize empty arrays for all postIds
    for (const id of postIds) {
      result.set(id, []);
    }

    // Fetch all non-deleted comments for these posts, ordered oldest-first
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
          avatarUrl: users.avatarUrl,
        },
      })
      .from(postComments)
      .innerJoin(users, eq(postComments.authorId, users.id))
      .where(
        and(
          inArray(postComments.postId, postIds),
          eq(postComments.isDeleted, false),
        ),
      )
      .orderBy(asc(postComments.createdAt));

    // Group by postId and take first COMMENT_PREVIEW_LIMIT per post
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
