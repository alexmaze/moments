import { pgTable, uuid, text, integer, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const mediaTypeEnum = pgEnum('media_type', ['image', 'video']);
export const mediaStatusEnum = pgEnum('media_status', ['pending', 'attached', 'orphaned']);

export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  uploaderId: uuid('uploader_id').notNull().references(() => users.id),
  type: mediaTypeEnum('type').notNull(),
  status: mediaStatusEnum('status').notNull().default('pending'),
  storagePath: text('storage_path').notNull(),
  publicUrl: text('public_url').notNull(),
  coverPath: text('cover_path'),
  coverUrl: text('cover_url'),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  durationSecs: integer('duration_secs'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
