import { pgTable, pgEnum, uuid, varchar, text, timestamp, boolean, integer, real, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

// --- Enums ---
export const spaceTypeEnum = pgEnum('space_type', ['general', 'baby']);
export const spaceMemberRoleEnum = pgEnum('space_member_role', ['owner', 'admin', 'member']);

// --- Spaces table ---
export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  coverUrl: text('cover_url'),
  coverPositionY: real('cover_position_y').notNull().default(50),
  type: spaceTypeEnum('type').notNull().default('general'),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  memberCount: integer('member_count').notNull().default(0),
  postCount: integer('post_count').notNull().default(0),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_spaces_slug').on(table.slug),
  index('idx_spaces_created_at').on(table.createdAt),
  index('idx_spaces_type').on(table.type),
]);

// --- Space Members (join table with role) ---
export const spaceMembers = pgTable('space_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id').notNull().references(() => spaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: spaceMemberRoleEnum('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('uniq_space_member').on(table.spaceId, table.userId),
  index('idx_space_members_user').on(table.userId),
  index('idx_space_members_space').on(table.spaceId),
]);

// --- Growth Records (baby spaces only) ---
export const growthRecords = pgTable('growth_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id').notNull().references(() => spaces.id, { onDelete: 'cascade' }),
  recordedBy: uuid('recorded_by').notNull().references(() => users.id),
  date: timestamp('date', { withTimezone: true }).notNull(),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  headCircumferenceCm: real('head_circumference_cm'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_growth_records_space_date').on(table.spaceId, table.date),
]);

export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type SpaceMember = typeof spaceMembers.$inferSelect;
export type NewSpaceMember = typeof spaceMembers.$inferInsert;
export type GrowthRecord = typeof growthRecords.$inferSelect;
export type NewGrowthRecord = typeof growthRecords.$inferInsert;
