import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, sql, desc, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, posts, postLikes, spaceMembers, users, mediaAssets } from '@moments/db';
import { NotificationsService } from '../notifications/notifications.service';
import type { LikedUserDto } from '@moments/shared';

@Injectable()
export class LikesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly notificationsService: NotificationsService,
  ) {}

  async toggle(postId: string, userId: string) {
    let postAuthorId: string | null = null;
    let postContent: string | null = null;

    const result = await this.db.transaction(async (tx) => {
      const [post] = await tx
        .select({ id: posts.id, spaceId: posts.spaceId, authorId: posts.authorId, content: posts.content })
        .from(posts)
        .where(and(eq(posts.id, postId), eq(posts.isDeleted, false)))
        .limit(1);

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      postAuthorId = post.authorId;
      postContent = post.content;

      if (post.spaceId) {
        const [membership] = await tx
          .select({ id: spaceMembers.id })
          .from(spaceMembers)
          .where(and(
            eq(spaceMembers.spaceId, post.spaceId),
            eq(spaceMembers.userId, userId),
          ))
          .limit(1);

        if (!membership) {
          throw new ForbiddenException('Join this space to interact with its posts');
        }
      }

      const [existing] = await tx
        .select({ id: postLikes.id })
        .from(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
        .limit(1);

      if (existing) {
        await tx
          .delete(postLikes)
          .where(eq(postLikes.id, existing.id));

        const [updated] = await tx
          .update(posts)
          .set({ likeCount: sql`${posts.likeCount} - 1` })
          .where(eq(posts.id, postId))
          .returning({ likeCount: posts.likeCount });

        return { liked: false, likeCount: updated.likeCount };
      } else {
        await tx
          .insert(postLikes)
          .values({ postId, userId });

        const [updated] = await tx
          .update(posts)
          .set({ likeCount: sql`${posts.likeCount} + 1` })
          .where(eq(posts.id, postId))
          .returning({ likeCount: posts.likeCount });

        return { liked: true, likeCount: updated.likeCount };
      }
    });

    if (result.liked && postAuthorId && userId !== postAuthorId) {
      await this.notificationsService.createLikeOnPostNotification(
        postId,
        postAuthorId,
        userId,
        postContent,
      );
    }

    return result;
  }

  async getLikedUsers(postId: string, cursor?: string, limit = 20, currentUserId?: string) {
    const safeLimit = Math.min(limit, 50);

    const [post] = await this.db
      .select({ id: posts.id, spaceId: posts.spaceId })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.isDeleted, false)))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.spaceId && currentUserId) {
      const [membership] = await this.db
        .select({ id: spaceMembers.id })
        .from(spaceMembers)
        .where(and(
          eq(spaceMembers.spaceId, post.spaceId),
          eq(spaceMembers.userId, currentUserId),
        ))
        .limit(1);

      if (!membership) {
        throw new ForbiddenException('Join this space to view likes on its posts');
      }
    }

    const conditions = [eq(postLikes.postId, postId)];
    if (cursor) {
      conditions.push(lt(postLikes.createdAt, new Date(cursor)));
    }

    let rows: { id: string; username: string; displayName: string; avatarUrl: string | null; spaceNickname: string | null; likedAt: Date }[];

    if (post.spaceId) {
      rows = await this.db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: mediaAssets.publicUrl,
          spaceNickname: spaceMembers.spaceNickname,
          likedAt: postLikes.createdAt,
        })
        .from(postLikes)
        .innerJoin(users, eq(postLikes.userId, users.id))
        .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
        .leftJoin(
          spaceMembers,
          and(eq(spaceMembers.spaceId, post.spaceId), eq(spaceMembers.userId, users.id)),
        )
        .where(and(...conditions))
        .orderBy(desc(postLikes.createdAt))
        .limit(safeLimit + 1);
    } else {
      rows = await this.db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: mediaAssets.publicUrl,
          spaceNickname: sql<string | null>`${null}`,
          likedAt: postLikes.createdAt,
        })
        .from(postLikes)
        .innerJoin(users, eq(postLikes.userId, users.id))
        .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
        .where(and(...conditions))
        .orderBy(desc(postLikes.createdAt))
        .limit(safeLimit + 1);
    }

    const hasMore = rows.length > safeLimit;
    const data = hasMore ? rows.slice(0, safeLimit) : rows;

    const likedUsers: LikedUserDto[] = data.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.spaceNickname ?? row.displayName,
      avatarUrl: row.avatarUrl,
      spaceNickname: row.spaceNickname,
      likedAt: row.likedAt.toISOString(),
    }));

    const lastRow = data.length > 0 ? data[data.length - 1] : null;

    return {
      data: likedUsers,
      meta: {
        hasMore,
        nextCursor: hasMore && lastRow ? lastRow.likedAt.toISOString() : null,
      },
    };
  }
}
