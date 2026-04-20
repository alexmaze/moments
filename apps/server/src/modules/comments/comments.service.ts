import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  forwardRef,
} from '@nestjs/common';
import { eq, and, sql, count, asc, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, posts, postComments, users, spaceMembers } from '@moments/db';
import { parseMentions } from '@moments/shared';
import { CreateCommentDto } from './dto';
import { MentionsService } from '../mentions/mentions.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly mentionsService: MentionsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  async create(postId: string, authorId: string, dto: CreateCommentDto) {
    return this.db.transaction(async (tx) => {
      const [post] = await tx
        .select({ id: posts.id, spaceId: posts.spaceId })
        .from(posts)
        .where(and(eq(posts.id, postId), eq(posts.isDeleted, false)))
        .limit(1);

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      if (post.spaceId) {
        const [membership] = await tx
          .select({ id: spaceMembers.id })
          .from(spaceMembers)
          .where(and(
            eq(spaceMembers.spaceId, post.spaceId),
            eq(spaceMembers.userId, authorId),
          ))
          .limit(1);

        if (!membership) {
          throw new ForbiddenException('Join this space to interact with its posts');
        }
      }

      if (dto.replyToId) {
        const [replyTarget] = await tx
          .select({ id: postComments.id, postId: postComments.postId, isDeleted: postComments.isDeleted })
          .from(postComments)
          .where(eq(postComments.id, dto.replyToId))
          .limit(1);

        if (!replyTarget || replyTarget.isDeleted) {
          throw new NotFoundException('Reply target comment not found');
        }
        if (replyTarget.postId !== postId) {
          throw new ForbiddenException('Cannot reply to a comment from a different post');
        }
      }

      const [comment] = await tx
        .insert(postComments)
        .values({
          postId,
          authorId,
          content: dto.content,
          replyToId: dto.replyToId ?? null,
        })
        .returning();

      await tx
        .update(posts)
        .set({ commentCount: sql`${posts.commentCount} + 1` })
        .where(eq(posts.id, postId));

      const parsedMentions = parseMentions(dto.content);
      if (parsedMentions.length > 0) {
        const mentionedUserIds = parsedMentions.map(m => m.userId);
        await this.mentionsService.createMentions(
          'comment',
          comment.id,
          authorId,
          mentionedUserIds,
        );
      }

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

      let replyTo = null;
      if (dto.replyToId) {
        const [replyTargetComment] = await tx
          .select({
            id: postComments.id,
            authorId: postComments.authorId,
            content: postComments.content,
          })
          .from(postComments)
          .where(eq(postComments.id, dto.replyToId))
          .limit(1);

        if (replyTargetComment) {
          const [replyAuthor] = await tx
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(eq(users.id, replyTargetComment.authorId))
            .limit(1);

          replyTo = {
            id: replyTargetComment.id,
            author: replyAuthor,
            contentPreview: replyTargetComment.content.slice(0, 50),
          };
        }
      }

      const mentionUsers = parsedMentions.length > 0
        ? await this.usersService.findByIds(parsedMentions.map(m => m.userId))
        : [];

      return {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        isDeleted: comment.isDeleted,
        author,
        replyTo,
        mentions: mentionUsers,
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
        replyToId: postComments.replyToId,
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

    const replyToIds = [...new Set(rows.map(r => r.replyToId).filter(Boolean))] as string[];

    let replyToMap = new Map<string, { id: string; author: { id: string; username: string; displayName: string; avatarUrl: string | null }; contentPreview: string }>();
    if (replyToIds.length > 0) {
      const replyComments = await this.db
        .select({
          id: postComments.id,
          content: postComments.content,
          authorId: postComments.authorId,
        })
        .from(postComments)
        .where(inArray(postComments.id, replyToIds));

      const replyAuthorIds = [...new Set(replyComments.map(r => r.authorId))];
      const replyAuthorRows = await this.db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.id, replyAuthorIds));
      const replyAuthorMap = new Map(replyAuthorRows.map(a => [a.id, a]));

      for (const rc of replyComments) {
        const author = replyAuthorMap.get(rc.authorId);
        if (author) {
          replyToMap.set(rc.id, {
            id: rc.id,
            author,
            contentPreview: rc.content.slice(0, 50),
          });
        }
      }
    }

    const allMentionedUserIds = new Set<string>();
    for (const row of rows) {
      const parsed = parseMentions(row.content);
      for (const m of parsed) {
        allMentionedUserIds.add(m.userId);
      }
    }

    let mentionsMap = new Map<string, { id: string; username: string; displayName: string; avatarUrl: string | null }[]>();
    if (allMentionedUserIds.size > 0) {
      const mentionUsers = await this.usersService.findByIds([...allMentionedUserIds]);
      const userMap = new Map(mentionUsers.map(u => [u.id, u]));

      for (const row of rows) {
        const parsed = parseMentions(row.content);
        const users = parsed
          .map(m => userMap.get(m.userId))
          .filter(Boolean) as { id: string; username: string; displayName: string; avatarUrl: string | null }[];
        const unique = [...new Map(users.map(u => [u.id, u])).values()];
        mentionsMap.set(row.id, unique);
      }
    }

    const data = rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      isDeleted: row.isDeleted,
      author: row.author,
      replyTo: row.replyToId ? replyToMap.get(row.replyToId) ?? null : null,
      mentions: mentionsMap.get(row.id) ?? [],
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

      await tx
        .update(postComments)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(eq(postComments.id, commentId));

      await tx
        .update(posts)
        .set({ commentCount: sql`${posts.commentCount} - 1` })
        .where(eq(posts.id, comment.postId));

      await this.mentionsService.deleteMentionsForEntity('comment', commentId);
    });
  }
}
