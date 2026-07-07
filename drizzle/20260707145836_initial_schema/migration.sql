CREATE TABLE "channel" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"guild_id" uuid,
	"discord_channel_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"kind" varchar(32) DEFAULT 'game' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"guild_id" uuid,
	"channel_id" uuid,
	"player_id" uuid,
	"command" text NOT NULL,
	"raw_message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_stat" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"country_code" varchar(2) NOT NULL UNIQUE,
	"times_used_as_target" integer DEFAULT 0 NOT NULL,
	"times_guessed" integer DEFAULT 0 NOT NULL,
	"times_guessed_wrong" integer DEFAULT 0 NOT NULL,
	"times_guessed_correct" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"guild_id" uuid,
	"channel_id" uuid,
	"game_master_player_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"screenshot_url" text NOT NULL,
	"screenshot_message_id" text,
	"announcement_message_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"winner_player_id" uuid,
	"winning_guess_id" uuid,
	"wrong_guess_count" integer DEFAULT 0 NOT NULL,
	"unique_wrong_country_count" integer DEFAULT 0 NOT NULL,
	"total_guess_count" integer DEFAULT 0 NOT NULL,
	"repeat_guess_count" integer DEFAULT 0 NOT NULL,
	"base_points" integer DEFAULT 100 NOT NULL,
	"current_multiplier_final" numeric(6,2) DEFAULT '1.00' NOT NULL,
	"gm_multiplier_at_start" numeric(6,2) DEFAULT '1.00' NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_master_milestone" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"player_id" uuid NOT NULL,
	"milestone_guess_count" integer NOT NULL,
	"game_id" uuid NOT NULL,
	"earned_multiplier_increment" numeric(6,2) DEFAULT '0.10' NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guess" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"discord_message_id" text NOT NULL,
	"raw_message" text NOT NULL,
	"parsed_country_code" varchar(2),
	"parsed_country_name" text,
	"parser_strategy" text,
	"is_correct" boolean DEFAULT false NOT NULL,
	"is_repeat" boolean DEFAULT false NOT NULL,
	"is_rate_limited" boolean DEFAULT false NOT NULL,
	"reaction" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"discord_guild_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"original_google_maps_url" text NOT NULL,
	"resolved_google_maps_url" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"coordinate_source" text NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"country_name" text,
	"region_name" text,
	"region_code" text,
	"nominatim_place_id" text,
	"nominatim_osm_type" text,
	"nominatim_osm_id" text,
	"nominatim_raw_json" jsonb,
	"manual_country_code" varchar(2),
	"manual_region_name" text,
	"is_manually_corrected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "multiplier_event" (
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
CREATE TABLE "player" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"discord_user_id" text NOT NULL UNIQUE,
	"display_name" text NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_game" (
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
CREATE TABLE "player_stat" (
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
CREATE TABLE "point_ledger" (
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
CREATE TABLE "rule" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"verified_role_id" text,
	"verified_role_name" text DEFAULT 'verified' NOT NULL,
	"game_channel_id" text,
	"log_channel_id" text,
	"command_prefixes" jsonb DEFAULT '["!"]' NOT NULL,
	"max_consecutive_guesses" integer DEFAULT 6 NOT NULL,
	"consecutive_guess_idle_reset_seconds" integer DEFAULT 1800 NOT NULL,
	"pending_start_ttl_seconds" integer DEFAULT 1800 NOT NULL,
	"base_win_points" integer DEFAULT 100 NOT NULL,
	"current_multiplier_max" numeric(6,2) DEFAULT '2.00' NOT NULL,
	"gm_multiplier_max" numeric(6,2) DEFAULT '3.00' NOT NULL,
	"idle_multiplier_interval_seconds" integer DEFAULT 900 NOT NULL,
	"idle_multiplier_increment" numeric(6,2) DEFAULT '0.10' NOT NULL,
	"long_game_multiplier_increment" numeric(6,2) DEFAULT '0.10' NOT NULL,
	"one_shot_bonus" numeric(6,2) DEFAULT '0.00' NOT NULL,
	"repeat_guess_counts_for_stats" boolean DEFAULT true NOT NULL,
	"repeat_guess_counts_for_gm_difficulty" boolean DEFAULT false NOT NULL,
	"queue_game_starts" boolean DEFAULT false NOT NULL,
	"nominatim_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "start_attempt" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"guild_id" uuid,
	"channel_id" uuid,
	"player_id" uuid,
	"status" varchar(32) NOT NULL,
	"reason" text,
	"original_google_maps_url" text,
	"screenshot_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "game_master_milestone_unique" ON "game_master_milestone" ("player_id","milestone_guess_count");--> statement-breakpoint
CREATE UNIQUE INDEX "player_game_unique" ON "player_game" ("player_id","game_id","role");--> statement-breakpoint
ALTER TABLE "channel" ADD CONSTRAINT "channel_guild_id_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guild"("id");--> statement-breakpoint
ALTER TABLE "command_log" ADD CONSTRAINT "command_log_guild_id_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guild"("id");--> statement-breakpoint
ALTER TABLE "command_log" ADD CONSTRAINT "command_log_channel_id_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel"("id");--> statement-breakpoint
ALTER TABLE "command_log" ADD CONSTRAINT "command_log_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_guild_id_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guild"("id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_channel_id_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel"("id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_game_master_player_id_player_id_fkey" FOREIGN KEY ("game_master_player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_winner_player_id_player_id_fkey" FOREIGN KEY ("winner_player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "game_master_milestone" ADD CONSTRAINT "game_master_milestone_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "game_master_milestone" ADD CONSTRAINT "game_master_milestone_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id");--> statement-breakpoint
ALTER TABLE "guess" ADD CONSTRAINT "guess_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id");--> statement-breakpoint
ALTER TABLE "guess" ADD CONSTRAINT "guess_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "multiplier_event" ADD CONSTRAINT "multiplier_event_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id");--> statement-breakpoint
ALTER TABLE "player_game" ADD CONSTRAINT "player_game_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "player_game" ADD CONSTRAINT "player_game_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id");--> statement-breakpoint
ALTER TABLE "player_stat" ADD CONSTRAINT "player_stat_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id");--> statement-breakpoint
ALTER TABLE "start_attempt" ADD CONSTRAINT "start_attempt_guild_id_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guild"("id");--> statement-breakpoint
ALTER TABLE "start_attempt" ADD CONSTRAINT "start_attempt_channel_id_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel"("id");--> statement-breakpoint
ALTER TABLE "start_attempt" ADD CONSTRAINT "start_attempt_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");