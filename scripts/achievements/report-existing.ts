/**
 * Local-only report: propose achievement unlocks for existing players.
 * Default is dry-run. Pass `--write` to insert with ON CONFLICT DO NOTHING (no Discord).
 * Run: `bun run sim:achievements:existing` or `… -- --write`
 */
import { closeDatabase } from "../../src/db/client.ts";
import { env } from "../../src/config/env.ts";
import { evaluateFullBackfillForPlayer } from "../../src/domain/achievements/evaluate.ts";
import {
  insertUnlocks,
  listAllPlayerIds,
} from "../../src/repositories/achievements-repository.ts";
import { assertLocalDatabaseUrl } from "./guard.ts";

const main = async () => {
  assertLocalDatabaseUrl(env.databaseUrl);
  const write = process.argv.includes("--write");
  console.log(
    `Achievement existing-data report (${write ? "WRITE" : "dry-run"}) — local DB OK\n`,
  );

  const playerIds = await listAllPlayerIds();
  const byAchievement = new Map<string, number>();
  let totalProposed = 0;
  let totalInserted = 0;
  let errors = 0;

  for (const playerId of playerIds) {
    try {
      const proposed = await evaluateFullBackfillForPlayer(playerId);
      totalProposed += proposed.length;
      for (const unlock of proposed) {
        byAchievement.set(
          unlock.achievementId,
          (byAchievement.get(unlock.achievementId) ?? 0) + 1,
        );
      }
      if (write && proposed.length > 0) {
        const inserted = await insertUnlocks(
          proposed.map((u) => ({
            playerId: u.playerId,
            achievementId: u.achievementId,
            tier: u.tier,
            sourceGameId: u.sourceGameId,
            meta: u.meta,
          })),
        );
        totalInserted += inserted.length;
      }
    } catch (error) {
      errors += 1;
      console.error(
        `player ${playerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const sorted = [...byAchievement.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`Players: ${playerIds.length}`);
  console.log(`Proposed unlocks: ${totalProposed}`);
  if (write) {
    console.log(`Inserted (new): ${totalInserted}`);
  }
  console.log(`Errors: ${errors}`);
  console.log("\nBy achievement:");
  for (const [id, count] of sorted) {
    console.log(`  ${id}: ${count}`);
  }
  if (!write) {
    console.log("\nDry-run only. Re-run with --write to persist unlocks.");
  }
};

try {
  await main();
} finally {
  await closeDatabase().catch(() => undefined);
}
