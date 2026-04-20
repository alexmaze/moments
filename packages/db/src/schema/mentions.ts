import { pgTable, pgEnum, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const mentionEntityTypeEnum = pgEnum('mention_entity_type', ['post', 'comment']);

export const mentions = pgTable('mentions', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: mentionEntityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  mentionerId: uuid('mentioner_id').notNull().references(() => users.id),
  mentionedUserId: uuid('mentioned_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_mentions_mentioned_user').on(table.mentionedUserId, table.createdAt),
  index('idx_mentions_entity').on(table.entityType, table.entityId),
]);

export type Mention = typeof mentions.$inferSelect;
export type NewMention = typeof mentions.$inferInsert;
