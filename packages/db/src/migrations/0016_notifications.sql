DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE "notification_type" AS ENUM ('mention_in_post', 'mention_in_comment', 'comment_on_post', 'reply_to_comment', 'like_on_post');
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"actor_count" integer DEFAULT 1 NOT NULL,
	"latest_actor_id" uuid,
	"post_id" uuid,
	"comment_id" uuid,
	"reply_to_comment_id" uuid,
	"content_preview" text,
	"aggregation_key" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_notification_actors" UNIQUE("notification_id","actor_id")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_recipient_id_users_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_latest_actor_id_users_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_latest_actor_id_users_id_fk" FOREIGN KEY ("latest_actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_post_id_posts_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_comment_id_post_comments_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_post_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_reply_to_comment_id_post_comments_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reply_to_comment_id_post_comments_id_fk" FOREIGN KEY ("reply_to_comment_id") REFERENCES "public"."post_comments"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_actors_notification_id_notifications_id_fk') THEN
    ALTER TABLE "notification_actors" ADD CONSTRAINT "notification_actors_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_actors_actor_id_users_id_fk') THEN
    ALTER TABLE "notification_actors" ADD CONSTRAINT "notification_actors_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_recipient_time" ON "notifications" USING btree ("recipient_id","last_event_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_recipient_unread" ON "notifications" USING btree ("recipient_id","is_read","last_event_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_aggregation_key" ON "notifications" USING btree ("aggregation_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_actors_notification" ON "notification_actors" USING btree ("notification_id","created_at");
