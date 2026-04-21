ALTER TABLE "posts" DROP COLUMN IF EXISTS "audio_url";
--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN IF EXISTS "audio_duration_secs";
--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN IF EXISTS "audio_mime_type";
--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN IF EXISTS "audio_size_bytes";
