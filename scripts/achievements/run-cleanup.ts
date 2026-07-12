/**
 * Local-only: delete all achievement sim seed rows (`sim_*` players/locations/periods).
 * Run: `bun run sim:achievements:cleanup`
 */
import { closeDatabase } from "../../src/db/client.ts";
import { env } from "../../src/config/env.ts";
import { cleanupSimData } from "./cleanup.ts";
import { assertLocalDatabaseUrl } from "./guard.ts";
import { color } from "./term.ts";

try {
  assertLocalDatabaseUrl(env.databaseUrl);
  await cleanupSimData();
  console.log(color.green("Cleaned up all sim_* achievement seed data."));
} finally {
  await closeDatabase().catch(() => undefined);
}
