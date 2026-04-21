ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "waveform" text;
--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN IF EXISTS "audio_waveform";
