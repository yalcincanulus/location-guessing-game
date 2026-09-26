CREATE TABLE "province_award_period" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"period_type" varchar(32) NOT NULL,
	"period_key" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"announced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "province_game" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"guild_id" uuid,
	"channel_id" uuid,
	"game_master_player_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"target_province_code" varchar(2) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"screenshot_url" text NOT NULL,
	"screenshot_message_id" text,
	"announcement_message_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"winner_player_id" uuid,
	"winning_guess_id" uuid,
	"wrong_guess_count" integer DEFAULT 0 NOT NULL,
	"unique_wrong_province_count" integer DEFAULT 0 NOT NULL,
	"total_guess_count" integer DEFAULT 0 NOT NULL,
	"repeat_guess_count" integer DEFAULT 0 NOT NULL,
	"base_points" integer DEFAULT 100 NOT NULL,
	"current_multiplier_final" numeric(6,2) DEFAULT '1.00' NOT NULL,
	"gm_multiplier_at_start" numeric(6,2) DEFAULT '1.00' NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"start_source" varchar(16),
	"announced_at" timestamp,
	"cancel_reason" text,
	"cancelled_by_player_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "province_game_start_source_known" CHECK ("start_source" IS NULL OR "start_source" IN ('dm', 'channel', 'hybrid'))
);
--> statement-breakpoint
CREATE TABLE "province_game_master_milestone" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"player_id" uuid NOT NULL,
	"milestone_guess_count" integer NOT NULL,
	"game_id" uuid NOT NULL,
	"earned_multiplier_increment" numeric(6,2) DEFAULT '0.10' NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "province_guess" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"discord_message_id" text NOT NULL,
	"raw_message" text NOT NULL,
	"parsed_province_code" varchar(2),
	"parsed_province_name" text,
	"parser_strategy" text,
	"is_correct" boolean DEFAULT false NOT NULL,
	"is_repeat" boolean DEFAULT false NOT NULL,
	"is_rate_limited" boolean DEFAULT false NOT NULL,
	"reaction" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "province_multiplier_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"game_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"previous_multiplier" numeric(6,2) NOT NULL,
	"increment" numeric(6,2) NOT NULL,
	"new_multiplier" numeric(6,2) NOT NULL,
	"message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "province_period_award" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"award_period_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"category" varchar(32) NOT NULL,
	"medal" varchar(16) NOT NULL,
	"rank_value" integer NOT NULL,
	"medal_points" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "province_player_achievement" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"player_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"tier" integer DEFAULT 0 NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL,
	"source_game_id" uuid,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "province_player_game" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"player_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'player' NOT NULL,
	"guess_count" integer DEFAULT 0 NOT NULL,
	"unique_wrong_guess_count" integer DEFAULT 0 NOT NULL,
	"repeat_guess_count" integer DEFAULT 0 NOT NULL,
	"first_guess_at" timestamp,
	"last_guess_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "province_player_stat" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"player_id" uuid NOT NULL UNIQUE,
	"games_started" integer DEFAULT 0 NOT NULL,
	"games_participated" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"total_guesses" integer DEFAULT 0 NOT NULL,
	"correct_guesses" integer DEFAULT 0 NOT NULL,
	"wrong_guesses" integer DEFAULT 0 NOT NULL,
	"repeat_guesses" integer DEFAULT 0 NOT NULL,
	"points_total" integer DEFAULT 0 NOT NULL,
	"best_single_game_points" integer DEFAULT 0 NOT NULL,
	"current_gm_multiplier" numeric(6,2) DEFAULT '1.00' NOT NULL,
	"max_game_wrong_guess_count_as_gm" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "province_point_ledger" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"player_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"base_points" integer NOT NULL,
	"current_multiplier" numeric(6,2) NOT NULL,
	"gm_multiplier" numeric(6,2) NOT NULL,
	"points_delta" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "province_stat" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"province_code" varchar(2) NOT NULL UNIQUE,
	"times_used_as_target" integer DEFAULT 0 NOT NULL,
	"times_guessed" integer DEFAULT 0 NOT NULL,
	"times_guessed_wrong" integer DEFAULT 0 NOT NULL,
	"times_guessed_correct" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rule" ADD COLUMN "province_game_channel_id" text;--> statement-breakpoint
ALTER TABLE "rule" ADD COLUMN "province_game_starts_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "province_award_period_type_key_unique" ON "province_award_period" ("period_type","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "province_game_master_milestone_unique" ON "province_game_master_milestone" ("player_id","milestone_guess_count");--> statement-breakpoint
CREATE UNIQUE INDEX "province_period_award_period_category_player_unique" ON "province_period_award" ("award_period_id","category","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "province_player_achievement_player_id_tier_unique" ON "province_player_achievement" ("player_id","achievement_id","tier");--> statement-breakpoint
CREATE UNIQUE INDEX "province_player_game_unique" ON "province_player_game" ("player_id","game_id","role");--> statement-breakpoint
ALTER TABLE "province_game" ADD CONSTRAINT "province_game_guild_id_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guild"("id");--> statement-breakpoint
ALTER TABLE "province_game" ADD CONSTRAINT "province_game_channel_id_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel"("id");--> statement-breakpoint
ALTER TABLE "province_game" ADD CONSTRAINT "province_game_game_master_player_id_player_id_fkey" FOREIGN KEY ("game_master_player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_game" ADD CONSTRAINT "province_game_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id");--> statement-breakpoint
ALTER TABLE "province_game" ADD CONSTRAINT "province_game_winner_player_id_player_id_fkey" FOREIGN KEY ("winner_player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_game" ADD CONSTRAINT "province_game_cancelled_by_player_id_player_id_fkey" FOREIGN KEY ("cancelled_by_player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_game_master_milestone" ADD CONSTRAINT "province_game_master_milestone_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_game_master_milestone" ADD CONSTRAINT "province_game_master_milestone_game_id_province_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "province_game"("id");--> statement-breakpoint
ALTER TABLE "province_guess" ADD CONSTRAINT "province_guess_game_id_province_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "province_game"("id");--> statement-breakpoint
ALTER TABLE "province_guess" ADD CONSTRAINT "province_guess_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_multiplier_event" ADD CONSTRAINT "province_multiplier_event_game_id_province_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "province_game"("id");--> statement-breakpoint
ALTER TABLE "province_period_award" ADD CONSTRAINT "province_period_award_Qh3AnOkYUFHv_fkey" FOREIGN KEY ("award_period_id") REFERENCES "province_award_period"("id");--> statement-breakpoint
ALTER TABLE "province_period_award" ADD CONSTRAINT "province_period_award_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_player_achievement" ADD CONSTRAINT "province_player_achievement_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_player_achievement" ADD CONSTRAINT "province_player_achievement_eA4Dm3idPQkz_fkey" FOREIGN KEY ("source_game_id") REFERENCES "province_game"("id");--> statement-breakpoint
ALTER TABLE "province_player_game" ADD CONSTRAINT "province_player_game_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_player_game" ADD CONSTRAINT "province_player_game_game_id_province_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "province_game"("id");--> statement-breakpoint
ALTER TABLE "province_player_stat" ADD CONSTRAINT "province_player_stat_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_point_ledger" ADD CONSTRAINT "province_point_ledger_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "province_point_ledger" ADD CONSTRAINT "province_point_ledger_game_id_province_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "province_game"("id");