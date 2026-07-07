ALTER TABLE "game" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "cancelled_by_player_id" uuid;--> statement-breakpoint
ALTER TABLE "rule" ADD COLUMN "test_mode_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rule" ADD COLUMN "test_channel_id" text;--> statement-breakpoint
ALTER TABLE "rule" ADD COLUMN "test_admin_user_ids" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_cancelled_by_player_id_player_id_fkey" FOREIGN KEY ("cancelled_by_player_id") REFERENCES "player"("id");