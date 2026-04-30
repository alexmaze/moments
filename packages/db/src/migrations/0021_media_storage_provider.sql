ALTER TABLE "media_assets"
  ADD COLUMN IF NOT EXISTS "storage_provider" text NOT NULL DEFAULT 'tencent-cos',
  ADD COLUMN IF NOT EXISTS "bucket" text,
  ADD COLUMN IF NOT EXISTS "object_key" text,
  ADD COLUMN IF NOT EXISTS "etag" text;

UPDATE "media_assets"
SET
  "object_key" = "storage_path"
WHERE "object_key" IS NULL;

ALTER TABLE "media_assets"
  ALTER COLUMN "object_key" SET NOT NULL;
