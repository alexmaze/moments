DO $$ BEGIN
 CREATE TYPE "public"."media_purpose" AS ENUM('post_attachment', 'user_avatar', 'space_cover');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "purpose" "media_purpose";
