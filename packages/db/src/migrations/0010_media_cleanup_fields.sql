ALTER TABLE "media_assets"
  ADD COLUMN IF NOT EXISTS "orphaned_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_cleanup_attempt_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "cleanup_error" text;
