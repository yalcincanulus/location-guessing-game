CREATE TABLE "player_achievement" (
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
CREATE UNIQUE INDEX "player_achievement_player_id_tier_unique" ON "player_achievement" ("player_id","achievement_id","tier");--> statement-breakpoint
ALTER TABLE "player_achievement" ADD CONSTRAINT "player_achievement_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "player_achievement" ADD CONSTRAINT "player_achievement_source_game_id_game_id_fkey" FOREIGN KEY ("source_game_id") REFERENCES "game"("id");