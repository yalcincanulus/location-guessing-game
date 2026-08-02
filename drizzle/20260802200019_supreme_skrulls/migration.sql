CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"player_id" uuid NOT NULL,
	"discord_message_id" text NOT NULL UNIQUE,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");