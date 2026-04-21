ALTER TABLE "media_assets"
  RENAME COLUMN "duration_secs" TO "duration_ms";

UPDATE "media_assets"
SET "duration_ms" = "duration_ms" * 1000
WHERE "duration_ms" IS NOT NULL;
