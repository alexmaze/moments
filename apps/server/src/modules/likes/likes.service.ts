import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, posts, postLikes, spaceMembers } from '@moments/db';

@Injectable()
export class LikesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
  ) {}

  async toggle(postId: string, userId: string) {
    return this.db.transaction(async (tx) => {
      // Check post exists
      const [post] = await tx
        .select({ id: posts.id, spaceId: posts.spaceId })
        .from(posts)
        .where(and(eq(posts.id, postId), eq(posts.isDeleted, false)))
        .limit(1);

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // If post belongs to a space, verify user is a member
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

      // Check if like already exists
      const [existing] = await tx
        .select({ id: postLikes.id })
        .from(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
        .limit(1);

      if (existing) {
        // Unlike
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
        // Like
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
  }
}
