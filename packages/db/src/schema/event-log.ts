import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

export const eventLog = pgTable('event_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),
  payload: jsonb('payload'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_event_log_user_id').on(table.userId),
  index('idx_event_log_event_type').on(table.eventType),
  index('idx_event_log_created_at').on(table.createdAt),
]);

export type EventLog = typeof eventLog.$inferSelect;
export type NewEventLog = typeof eventLog.$inferInsert;
