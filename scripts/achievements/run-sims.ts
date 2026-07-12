/**
 * Local-only achievement DB simulations. Run: `bun run sim:achievements`
 * Seeds `sim_*` rows, evaluates unlocks against Postgres, asserts, then cleans up.
 * Not part of `bun test` / deploy.
 *
 * Flags:
 *   --keep              Skip final cleanup so you can inspect the DB
 *   --scenario <name>   Run only one scenario (useful with --keep)
 *
 * Inspect then wipe: `bun run sim:achievements:keep` → `bun run sim:achievements:cleanup`
 */
import { closeDatabase } from "../../src/db/client.ts";
import { env } from "../../src/config/env.ts";
import { cleanupSimData } from "./cleanup.ts";
import { assertLocalDatabaseUrl } from "./guard.ts";
import {
  assertExpected,
  scenarios,
  type ExpectedUnlock,
  type ScenarioResult,
} from "./scenarios.ts";
import { color, formatUnlock } from "./term.ts";

const parseArgs = (argv: string[]) => {
  const keep = argv.includes("--keep") || argv.includes("--no-cleanup");
  const scenarioIdx = argv.findIndex((arg) => arg === "--scenario" || arg.startsWith("--scenario="));
  let scenarioName: string | undefined;
  if (scenarioIdx >= 0) {
    const arg = argv[scenarioIdx]!;
    scenarioName = arg.startsWith("--scenario=")
      ? arg.slice("--scenario=".length)
      : argv[scenarioIdx + 1];
  }
  return { keep, scenarioName };
};

const unlockKey = (playerId: string, achievementId: string, tier: number) =>
  `${playerId}:${achievementId}:${tier}`;

const shortPlayer = (playerId: string) => color.dim(playerId.slice(0, 8));

const printUnlockList = (
  label: string,
  items: { playerId: string; achievementId: string; tier: number }[],
  mark?: "ok" | "miss" | "bonus",
) => {
  const prefix =
    mark === "ok"
      ? color.green("✓")
      : mark === "miss"
        ? color.red("✗")
        : mark === "bonus"
          ? color.magenta("+")
          : color.dim("•");
  console.log(`  ${color.bold(label)} ${color.dim(`(${items.length})`)}`);
  if (items.length === 0) {
    console.log(`    ${color.dim("(none)")}`);
    return;
  }
  for (const item of items) {
    console.log(
      `    ${prefix} ${formatUnlock(item.achievementId, item.tier)}  ${shortPlayer(item.playerId)}`,
    );
  }
};

const printScenarioReport = (
  index: number,
  total: number,
  result: ScenarioResult,
  missing: ExpectedUnlock[],
  ok: boolean,
  elapsedMs: number,
) => {
  const status = ok ? color.green(color.bold("PASS")) : color.red(color.bold("FAIL"));
  const bar = color.dim("─".repeat(56));
  console.log(bar);
  console.log(
    `${status}  ${color.bold(result.name)}  ${color.dim(`[${index}/${total}]`)}  ${color.gray(`${elapsedMs}ms`)}`,
  );

  const insertedKeys = new Set(
    result.inserted.map((u) => unlockKey(u.playerId, u.achievementId, u.tier)),
  );
  const expectedFound = result.expected.filter((e) =>
    insertedKeys.has(unlockKey(e.playerId, e.achievementId, e.tier)),
  );
  const bonus = result.inserted.filter(
    (u) =>
      !result.expected.some(
        (e) =>
          e.playerId === u.playerId &&
          e.achievementId === u.achievementId &&
          e.tier === u.tier,
      ),
  );

  printUnlockList("expected (matched)", expectedFound, "ok");
  if (missing.length > 0) {
    printUnlockList("expected (missing)", missing, "miss");
  }
  printUnlockList("inserted (all)", result.inserted, "ok");
  if (bonus.length > 0) {
    printUnlockList("bonus (not asserted)", bonus, "bonus");
  }

  if (result.proposed.length !== result.inserted.length) {
    console.log(
      `  ${color.dim("proposed")} ${result.proposed.length}  ${color.dim("→")}  ${color.dim("inserted")} ${result.inserted.length} ${color.dim("(conflict/skip)")}`,
    );
  }

  if (result.extraMessage !== undefined) {
    const extraColor = result.extraOk === false ? color.red : color.green;
    console.log(`  ${color.bold("extra")}  ${extraColor(result.extraMessage)}`);
  }

  console.log(
    `  ${color.dim("summary")}  expected ${result.expected.length} · matched ${expectedFound.length} · missing ${missing.length} · inserted ${result.inserted.length} · bonus ${bonus.length}`,
  );
};

const main = async () => {
  assertLocalDatabaseUrl(env.databaseUrl);
  const { keep, scenarioName } = parseArgs(process.argv.slice(2));

  const selected = scenarioName
    ? scenarios.filter((scenario) => scenario.name === scenarioName)
    : scenarios;

  if (scenarioName && selected.length === 0) {
    const names = scenarios.map((scenario) => scenario.name).join(", ");
    throw new Error(`Unknown scenario "${scenarioName}". Available: ${names}`);
  }

  console.log(color.bold("Achievement sims"), color.dim("—"), color.green("local DB OK"));
  console.log(
    color.dim(
      `Running ${selected.length} scenario(s)${keep ? " (keeping data after)" : ""}…`,
    ),
  );
  console.log();

  await cleanupSimData();

  let failed = 0;
  const startedAll = Date.now();

  for (let i = 0; i < selected.length; i += 1) {
    const scenario = selected[i]!;
    const started = Date.now();
    try {
      if (i > 0) {
        await cleanupSimData();
      }
      const result = await scenario.run();
      const missing = assertExpected(result.expected, result.inserted);
      const extraFailed = result.extraOk === false;
      const ok = missing.length === 0 && !extraFailed;
      if (!ok) {
        failed += 1;
      }
      printScenarioReport(i + 1, selected.length, result, missing, ok, Date.now() - started);
      if (!ok && result.proposed.length > 0 && missing.length > 0) {
        printUnlockList(
          "proposed (debug)",
          result.proposed.map((u) => ({
            playerId: u.playerId,
            achievementId: u.achievementId,
            tier: u.tier,
          })),
        );
      }
      console.log();
    } catch (error) {
      failed += 1;
      const bar = color.dim("─".repeat(56));
      console.log(bar);
      console.error(
        `${color.red(color.bold("FAIL"))}  ${color.bold(scenario.name)}  ${color.dim(`[${i + 1}/${selected.length}]`)}  ${color.gray(`${Date.now() - started}ms`)}`,
      );
      console.error(
        `  ${color.red("error")}  ${error instanceof Error ? error.message : String(error)}`,
      );
      if (error instanceof Error && error.stack) {
        console.error(color.dim(error.stack.split("\n").slice(1, 4).join("\n")));
      }
      console.log();
    }
  }

  const totalMs = Date.now() - startedAll;
  const bar = color.dim("═".repeat(56));
  console.log(bar);

  if (keep) {
    const last = selected[selected.length - 1]?.name;
    console.log(
      color.yellow(
        `Kept sim_* rows${last ? ` (last scenario: ${last})` : ""}. Inspect, then run: bun run sim:achievements:cleanup`,
      ),
    );
  } else {
    await cleanupSimData();
    console.log(color.dim("Cleaned up sim_* rows."));
  }

  if (failed === 0) {
    console.log(
      color.green(color.bold(`All ${selected.length} scenario(s) passed.`)),
      color.gray(`(${totalMs}ms)`),
    );
  } else {
    console.log(
      color.red(color.bold(`${failed} of ${selected.length} scenario(s) failed.`)),
      color.gray(`(${totalMs}ms)`),
    );
  }
  process.exitCode = failed === 0 ? 0 : 1;
};

try {
  await main();
} finally {
  await closeDatabase().catch(() => undefined);
}
