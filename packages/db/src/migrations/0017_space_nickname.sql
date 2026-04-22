ALTER TABLE "space_members" ADD COLUMN IF NOT EXISTS "space_nickname" varchar(10);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_space_nickname" ON "space_members" ("space_id", "space_nickname") WHERE "space_nickname" IS NOT NULL;
