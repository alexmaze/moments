CREATE TYPE "public"."mention_entity_type" AS ENUM('post', 'comment');--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "mention_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"mentioner_id" uuid NOT NULL,
	"mentioned_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_comments" ADD COLUMN "reply_to_id" uuid;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioner_id_users_id_fk" FOREIGN KEY ("mentioner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mentions_mentioned_user" ON "mentions" USING btree ("mentioned_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_mentions_entity" ON "mentions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_comments_reply_to" ON "post_comments" USING btree ("reply_to_id");