import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, lt, inArray, sql, asc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import {
  type DrizzleClient,
  notifications,
  notificationActors,
  users,
  mediaAssets,
  posts,
  postMediaRelations,
} from '@moments/db';

const CONTENT_PREVIEW_MAX = 80;

function truncatePreview(content: string | null): string | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > CONTENT_PREVIEW_MAX
    ? trimmed.slice(0, CONTENT_PREVIEW_MAX) + '…'
    : trimmed;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
  ) {}

  async createMentionInPostNotification(
    postId: string,
    mentionedUserId: string,
    actorId: string,
    contentPreview: string | null,
  ) {
    if (actorId === mentionedUserId) return;

    const aggregationKey = `mention:post:${postId}:${mentionedUserId}`;

    const [existing] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.aggregationKey, aggregationKey))
      .limit(1);

    if (existing) return;

    const [notif] = await this.db
      .insert(notifications)
      .values({
        recipientId: mentionedUserId,
        type: 'mention_in_post',
        postId,
        contentPreview: truncatePreview(contentPreview),
        aggregationKey,
        latestActorId: actorId,
      })
      .returning();

    await this.db.insert(notificationActors).values({
      notificationId: notif.id,
      actorId,
    });
  }

  async createMentionInCommentNotification(
    postId: string,
    commentId: string,
    mentionedUserId: string,
    actorId: string,
    contentPreview: string | null,
  ) {
    if (actorId === mentionedUserId) return;

    const aggregationKey = `mention:comment:${commentId}:${mentionedUserId}`;

    const [existing] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.aggregationKey, aggregationKey))
      .limit(1);

    if (existing) return;

    const [notif] = await this.db
      .insert(notifications)
      .values({
        recipientId: mentionedUserId,
        type: 'mention_in_comment',
        postId,
        commentId,
        contentPreview: truncatePreview(contentPreview),
        aggregationKey,
        latestActorId: actorId,
      })
      .returning();

    await this.db.insert(notificationActors).values({
      notificationId: notif.id,
      actorId,
    });
  }

  async createCommentOnPostNotification(
    postId: string,
    commentId: string,
    postAuthorId: string,
    actorId: string,
    contentPreview: string | null,
  ) {
    if (actorId === postAuthorId) return;

    const aggregationKey = `comment:${commentId}:recipient:${postAuthorId}`;

    const [existing] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.aggregationKey, aggregationKey))
      .limit(1);

    if (existing) return;

    const [notif] = await this.db
      .insert(notifications)
      .values({
        recipientId: postAuthorId,
        type: 'comment_on_post',
        postId,
        commentId,
        contentPreview: truncatePreview(contentPreview),
        aggregationKey,
        latestActorId: actorId,
      })
      .returning();

    await this.db.insert(notificationActors).values({
      notificationId: notif.id,
      actorId,
    });
  }

  async createReplyToCommentNotification(
    postId: string,
    commentId: string,
    replyToCommentId: string,
    replyToAuthorId: string,
    actorId: string,
    contentPreview: string | null,
    _replyContentPreview: string | null,
  ) {
    if (actorId === replyToAuthorId) return;

    const aggregationKey = `reply:${commentId}:recipient:${replyToAuthorId}`;

    const [existing] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.aggregationKey, aggregationKey))
      .limit(1);

    if (existing) return;

    const [notif] = await this.db
      .insert(notifications)
      .values({
        recipientId: replyToAuthorId,
        type: 'reply_to_comment',
        postId,
        commentId,
        replyToCommentId,
        contentPreview: truncatePreview(contentPreview),
        aggregationKey,
        latestActorId: actorId,
      })
      .returning();

    await this.db.insert(notificationActors).values({
      notificationId: notif.id,
      actorId,
    });
  }

  async createLikeOnPostNotification(
    postId: string,
    postAuthorId: string,
    actorId: string,
    contentPreview: string | null,
  ) {
    if (actorId === postAuthorId) return;

    const today = new Date().toISOString().slice(0, 10);
    const aggregationKey = `like:${postId}:${postAuthorId}:${today}`;

    const [existing] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.aggregationKey, aggregationKey))
      .limit(1);

    if (existing) {
      await this.db
        .update(notifications)
        .set({
          actorCount: sql`${notifications.actorCount} + 1`,
          latestActorId: actorId,
          lastEventAt: new Date(),
          isRead: false,
          readAt: null,
        })
        .where(eq(notifications.id, existing.id));

      await this.db
        .insert(notificationActors)
        .values({
          notificationId: existing.id,
          actorId,
        })
        .onConflictDoNothing();
    } else {
      const [notif] = await this.db
        .insert(notifications)
        .values({
          recipientId: postAuthorId,
          type: 'like_on_post',
          postId,
          contentPreview: truncatePreview(contentPreview),
          aggregationKey,
          latestActorId: actorId,
        })
        .returning();

      await this.db.insert(notificationActors).values({
        notificationId: notif.id,
        actorId,
      });
    }
  }

  async listForUser(
    userId: string,
    cursor?: string,
    limit = 20,
    filter: 'all' | 'unread' = 'all',
  ) {
    const safeLimit = Math.min(limit, 50);

    const conditions = [eq(notifications.recipientId, userId)];
    if (filter === 'unread') {
      conditions.push(eq(notifications.isRead, false));
    }
    if (cursor) {
      conditions.push(lt(notifications.lastEventAt, new Date(cursor)));
    }

    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.lastEventAt))
      .limit(safeLimit + 1);

    const hasMore = rows.length > safeLimit;
    const resultRows = hasMore ? rows.slice(0, safeLimit) : rows;

    if (resultRows.length === 0) {
      return { data: [], meta: { hasMore: false, nextCursor: null, unreadCount: 0 } };
    }

    const notifIds = resultRows.map((n) => n.id);
    const latestActorIds = [...new Set(resultRows.map((n) => n.latestActorId).filter(Boolean))] as string[];

    const actorRows = await this.db
      .select({
        notificationId: notificationActors.notificationId,
        actorId: notificationActors.actorId,
        actorCreatedAt: notificationActors.createdAt,
      })
      .from(notificationActors)
      .where(inArray(notificationActors.notificationId, notifIds))
      .orderBy(desc(notificationActors.createdAt));

    const allActorIds = [...new Set(actorRows.map((a) => a.actorId))];
    const uniqueActorIds = [...new Set([...latestActorIds, ...allActorIds])];

    const actorUserRows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: mediaAssets.publicUrl,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(inArray(users.id, uniqueActorIds));

    const actorUserMap = new Map(actorUserRows.map((u) => [u.id, u]));

    const actorsByNotif = new Map<string, string[]>();
    for (const row of actorRows) {
      const list = actorsByNotif.get(row.notificationId) || [];
      list.push(row.actorId);
      actorsByNotif.set(row.notificationId, list);
    }

    const postIds = [...new Set(resultRows.map((n) => n.postId).filter(Boolean))] as string[];

    const postRows = postIds.length > 0
      ? await this.db
          .select({
            id: posts.id,
            content: posts.content,
            audioMediaId: posts.audioMediaId,
          })
          .from(posts)
          .where(inArray(posts.id, postIds))
      : [];

    const postMap = new Map(postRows.map((p) => [p.id, p]));

    const audioMediaIds = [...new Set(postRows.map((p) => p.audioMediaId).filter(Boolean))] as string[];
    const audioRows = audioMediaIds.length > 0
      ? await this.db
          .select({
            id: mediaAssets.id,
            durationMs: mediaAssets.durationMs,
          })
          .from(mediaAssets)
          .where(inArray(mediaAssets.id, audioMediaIds))
      : [];
    const audioMap = new Map(audioRows.map((a) => [a.id, a]));

    const firstMediaRows = postIds.length > 0
      ? await this.db
          .select({
            postId: postMediaRelations.postId,
            mediaId: postMediaRelations.mediaId,
            sortOrder: postMediaRelations.sortOrder,
          })
          .from(postMediaRelations)
          .where(inArray(postMediaRelations.postId, postIds))
          .orderBy(asc(postMediaRelations.sortOrder))
      : [];

    const firstMediaByPost = new Map<string, typeof firstMediaRows[0]>();
    for (const row of firstMediaRows) {
      if (!firstMediaByPost.has(row.postId)) {
        firstMediaByPost.set(row.postId, row);
      }
    }

    const mediaIds = [...new Set(firstMediaRows.map((m) => m.mediaId))];
    const mediaRows = mediaIds.length > 0
      ? await this.db
          .select({
            id: mediaAssets.id,
            type: mediaAssets.type,
            publicUrl: mediaAssets.publicUrl,
            coverUrl: mediaAssets.coverUrl,
          })
          .from(mediaAssets)
          .where(inArray(mediaAssets.id, mediaIds))
      : [];
    const mediaMap = new Map(mediaRows.map((m) => [m.id, m]));

    const data = resultRows.map((notif) => {
      const actorIdsForNotif = actorsByNotif.get(notif.id) || [];
      const actorsPreview = actorIdsForNotif
        .slice(0, 3)
        .map((id) => actorUserMap.get(id))
        .filter(Boolean);

      const latestActor = notif.latestActorId
        ? actorUserMap.get(notif.latestActorId) ?? null
        : null;

      const navigationTarget: { postId: string; commentId?: string } | null = notif.postId
        ? { postId: notif.postId, ...(notif.commentId ? { commentId: notif.commentId } : {}) }
        : null;

      let postPreview: { id: string; content: string | null; firstMedia: { type: 'image' | 'video'; publicUrl: string; coverUrl: string | null } | null; audio: { durationMs: number } | null } | null = null;
      if (notif.postId) {
        const post = postMap.get(notif.postId);
        if (post) {
          const firstMediaRel = firstMediaByPost.get(notif.postId);
          const firstMedia = firstMediaRel
            ? (() => {
                const m = mediaMap.get(firstMediaRel.mediaId);
                if (!m || (m.type !== 'image' && m.type !== 'video')) return null;
                return { type: m.type, publicUrl: m.publicUrl, coverUrl: m.coverUrl };
              })()
            : null;

          const audio = post.audioMediaId
            ? (() => {
                const a = audioMap.get(post.audioMediaId);
                return a ? { durationMs: a.durationMs ?? 0 } : null;
              })()
            : null;

          postPreview = {
            id: post.id,
            content: post.content,
            firstMedia,
            audio,
          };
        }
      }

      return {
        id: notif.id,
        type: notif.type,
        isRead: notif.isRead,
        createdAt: notif.createdAt.toISOString(),
        lastEventAt: notif.lastEventAt.toISOString(),
        actorCount: notif.actorCount,
        latestActor,
        actorsPreview,
        post: postPreview,
        comment: notif.commentId
          ? { id: notif.commentId, contentPreview: notif.contentPreview }
          : null,
        replyToComment: notif.replyToCommentId
          ? { id: notif.replyToCommentId, contentPreview: null }
          : null,
        contentPreview: notif.contentPreview,
        navigationTarget,
      };
    });

    const [{ count: unreadCount }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));

    const lastRow = resultRows[resultRows.length - 1];
    return {
      data,
      meta: {
        hasMore,
        nextCursor: hasMore ? lastRow.lastEventAt.toISOString() : null,
        unreadCount,
      },
    };
  }

  async getUnreadCount(userId: string) {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));

    return { unreadCount: count };
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, userId)));
  }

  async markAllAsRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));
  }
}
