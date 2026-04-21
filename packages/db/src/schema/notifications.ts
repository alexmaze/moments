import { pgTable, pgEnum, uuid, varchar, text, timestamp, boolean, integer, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { posts } from './posts';
import { postComments } from './posts';

export const notificationTypeEnum = pgEnum('notification_type', [
  'mention_in_post',
  'mention_in_comment',
  'comment_on_post',
  'reply_to_comment',
  'like_on_post',
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientId: uuid('recipient_id').notNull().references(() => users.id),
  type: notificationTypeEnum('type').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  actorCount: integer('actor_count').notNull().default(1),
  latestActorId: uuid('latest_actor_id').references(() => users.id),
  postId: uuid('post_id').references(() => posts.id),
  commentId: uuid('comment_id').references(() => postComments.id),
  replyToCommentId: uuid('reply_to_comment_id').references(() => postComments.id),
  contentPreview: text('content_preview'),
  aggregationKey: varchar('aggregation_key', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastEventAt: timestamp('last_event_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_notifications_recipient_time').on(table.recipientId, table.lastEventAt),
  index('idx_notifications_recipient_unread').on(table.recipientId, table.isRead, table.lastEventAt),
  index('idx_notifications_aggregation_key').on(table.aggregationKey),
]);

export const notificationActors = pgTable('notification_actors', {
  id: uuid('id').primaryKey().defaultRandom(),
  notificationId: uuid('notification_id').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('uniq_notification_actors').on(table.notificationId, table.actorId),
  index('idx_notification_actors_notification').on(table.notificationId, table.createdAt),
]);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationActor = typeof notificationActors.$inferSelect;
export type NewNotificationActor = typeof notificationActors.$inferInsert;
