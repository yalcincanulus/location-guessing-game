CREATE TABLE "award_period" (
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
CREATE TABLE "period_award" (
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
CREATE UNIQUE INDEX "award_period_type_key_unique" ON "award_period" ("period_type","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "period_award_period_category_player_unique" ON "period_award" ("award_period_id","category","player_id");--> statement-breakpoint
ALTER TABLE "period_award" ADD CONSTRAINT "period_award_award_period_id_award_period_id_fkey" FOREIGN KEY ("award_period_id") REFERENCES "award_period"("id");--> statement-breakpoint
ALTER TABLE "period_award" ADD CONSTRAINT "period_award_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");