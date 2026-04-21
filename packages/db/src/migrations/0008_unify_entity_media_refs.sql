ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_media_id" uuid;
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "cover_media_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_avatar_media_id_media_assets_id_fk"
 FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media_assets"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spaces" ADD CONSTRAINT "spaces_cover_media_id_media_assets_id_fk"
 FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_url";
--> statement-breakpoint
ALTER TABLE "spaces" DROP COLUMN IF EXISTS "cover_url";
--> statement-breakpoint
UPDATE "media_assets" m
SET "status" = 'attached'
WHERE m."status" <> 'attached'
  AND (
    EXISTS (SELECT 1 FROM "post_media_relations" pmr WHERE pmr."media_id" = m."id")
    OR EXISTS (SELECT 1 FROM "users" u WHERE u."avatar_media_id" = m."id")
    OR EXISTS (SELECT 1 FROM "spaces" s WHERE s."cover_media_id" = m."id")
  );
