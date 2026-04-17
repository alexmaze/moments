import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, sql, count, asc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, posts, postComments, users } from '@moments/db';
import { CreateCommentDto } from './dto';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
  ) {}

  async create(postId: string, authorId: string, dto: CreateCommentDto) {
    return this.db.transaction(async (tx) => {
      // Check post exists
      const [post] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.id, postId), eq(posts.isDeleted, false)))
        .limit(1);

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // Insert comment
      const [comment] = await tx
        .insert(postComments)
        .values({
          postId,
          authorId,
          content: dto.content,
        })
        .returning();

      // Increment comment count
      await tx
        .update(posts)
        .set({ commentCount: sql`${posts.commentCount} + 1` })
        .where(eq(posts.id, postId));

      // Fetch author info
      const [author] = await tx
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, authorId))
        .limit(1);

      return {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        isDeleted: comment.isDeleted,
        author,
      };
    });
  }

  async listByPost(postId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const [totalResult] = await this.db
      .select({ total: count() })
      .from(postComments)
      .where(
        and(
          eq(postComments.postId, postId),
          eq(postComments.isDeleted, false),
        ),
      );

    const total = totalResult.total;

    const rows = await this.db
      .select({
        id: postComments.id,
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
          eq(postComments.postId, postId),
          eq(postComments.isDeleted, false),
        ),
      )
      .orderBy(asc(postComments.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      data,
      meta: {
        total,
        page,
        pageSize: limit,
        hasMore: offset + rows.length < total,
      },
    };
  }

  async deleteOwn(commentId: string, userId: string) {
    return this.db.transaction(async (tx) => {
      const [comment] = await tx
        .select({
          id: postComments.id,
          authorId: postComments.authorId,
          postId: postComments.postId,
          isDeleted: postComments.isDeleted,
        })
        .from(postComments)
        .where(eq(postComments.id, commentId))
        .limit(1);

      if (!comment || comment.isDeleted) {
        throw new NotFoundException('Comment not found');
      }

      if (comment.authorId !== userId) {
        throw new ForbiddenException('You can only delete your own comments');
      }

      // Soft delete
      await tx
        .update(postComments)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(eq(postComments.id, commentId));

      // Decrement comment count
      await tx
        .update(posts)
        .set({ commentCount: sql`${posts.commentCount} - 1` })
        .where(eq(posts.id, comment.postId));
    });
  }
}
