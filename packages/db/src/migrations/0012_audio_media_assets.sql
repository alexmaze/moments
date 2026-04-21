DO $$ BEGIN
  ALTER TYPE "public"."media_type" ADD VALUE IF NOT EXISTS 'audio';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "audio_media_id" uuid;
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "audio_waveform" text;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_audio_media_id_media_assets_id_fk"
 FOREIGN KEY ("audio_media_id") REFERENCES "public"."media_assets"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
