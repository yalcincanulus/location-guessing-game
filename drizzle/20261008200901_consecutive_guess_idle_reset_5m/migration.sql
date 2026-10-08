ALTER TABLE "rule" ALTER COLUMN "consecutive_guess_idle_reset_seconds" SET DEFAULT 300;--> statement-breakpoint
UPDATE "rule" SET "consecutive_guess_idle_reset_seconds" = 300;