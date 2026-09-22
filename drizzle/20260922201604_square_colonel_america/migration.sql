CREATE TABLE "suspicion_dismissal" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"player_id" uuid NOT NULL,
	"other_player_id" uuid NOT NULL,
	"dismissed_by_discord_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "suspicion_dismissal_ordered" CHECK ("player_id" < "other_player_id")
);
--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "start_source" varchar(16);--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "announced_at" timestamp;--> statement-breakpoint
ALTER TABLE "guess" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "discord_created_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "suspicion_dismissal_pair_unique" ON "suspicion_dismissal" ("player_id","other_player_id");--> statement-breakpoint
ALTER TABLE "suspicion_dismissal" ADD CONSTRAINT "suspicion_dismissal_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "suspicion_dismissal" ADD CONSTRAINT "suspicion_dismissal_other_player_id_player_id_fkey" FOREIGN KEY ("other_player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_start_source_known" CHECK ("start_source" IS NULL OR "start_source" IN ('dm', 'channel', 'hybrid'));--> statement-breakpoint
UPDATE "player"
SET "discord_created_at" = to_timestamp((("discord_user_id"::bigint >> 22) + 1420070400000) / 1000.0)
WHERE "discord_created_at" IS NULL
  AND "discord_user_id" ~ '^[0-9]+$'
  AND (
    length("discord_user_id") < 19
    OR (
      length("discord_user_id") = 19
      AND "discord_user_id" <= '9223372036854775807'
    )
  );--> statement-breakpoint
UPDATE "guess"
SET "sent_at" = to_timestamp((("discord_message_id"::bigint >> 22) + 1420070400000) / 1000.0)
WHERE "sent_at" IS NULL
  AND "discord_message_id" ~ '^[0-9]+$'
  AND (
    length("discord_message_id") < 19
    OR (
      length("discord_message_id") = 19
      AND "discord_message_id" <= '9223372036854775807'
    )
  );--> statement-breakpoint
UPDATE "game"
SET "announced_at" = to_timestamp((("announcement_message_id"::bigint >> 22) + 1420070400000) / 1000.0)
WHERE "announced_at" IS NULL
  AND "announcement_message_id" ~ '^[0-9]+$'
  AND (
    length("announcement_message_id") < 19
    OR (
      length("announcement_message_id") = 19
      AND "announcement_message_id" <= '9223372036854775807'
    )
  );