import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, posts, postLikes, spaceMembers } from '@moments/db';
import { NotificationsService } from '../notifications/notifications.service';

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
}
