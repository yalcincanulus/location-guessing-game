import type { Client } from "discord.js";
import { loadRules } from "../../config/rules.ts";
import {
  MEDAL_EMOJI,
  getPreviousPeriodWindow,
  periodsToFinalize,
  type AwardCategory,
  type Medal,
  type PeriodType,
  type PeriodWindow,
} from "./periods.ts";
import { messages } from "../../i18n/messages.ts";
import { logger } from "../../util/logger.ts";
import {
  finalizePeriodAwards,
  markPeriodAnnounced,
  type CategoryStandings,
} from "../../repositories/awards-repository.ts";
import { onPeriodAwardsFinalized } from "../achievements/hooks.ts";
import { gameChannelIdFor, type GameMode } from "../game/game-mode.ts";

const medalByPlayer = (standings: CategoryStandings): Map<string, Medal> => {
  const map = new Map<string, Medal>();
  for (const award of standings.medals) {
    map.set(award.playerId, award.medal);
  }
  return map;
};

export const formatCategoryStandings = (standings: CategoryStandings): string => {
  const title = messages.awards.categoryTitle(standings.category);
  if (standings.rows.length === 0) {
    return `${title}\n${messages.awards.noCategoryData}`;
  }

  const medals = medalByPlayer(standings);
  const lines = standings.rows.map((row, index) => {
    const medal = medals.get(row.playerId);
    return messages.awards.standingRow(
      index + 1,
      row.displayName,
      row.value,
      medal ? MEDAL_EMOJI[medal] : undefined,
    );
  });

  return [title, ...lines].join("\n");
};

export const formatPeriodStandingsMessage = (
  window: PeriodWindow,
  standings: CategoryStandings[],
  kind: "live" | "results",
  mode: GameMode = "country",
): string => {
  const header =
    kind === "results"
      ? messages.awards.resultsHeader(window.periodType, window.periodKey)
      : messages.awards.liveHeader(window.periodType, window.periodKey);

  const title = mode === "province" ? `${messages.province.label}\n${header}` : header;
  return [title, ...standings.map(formatCategoryStandings)].join("\n\n");
};

export const announcePeriodResults = async (
  client: Client,
  window: PeriodWindow,
  standings: CategoryStandings[],
  mode: GameMode = "country",
): Promise<boolean> => {
  const rules = await loadRules();
  const channelId = gameChannelIdFor(rules, mode);
  if (!channelId) {
    logger.warn("Period awards: game channel not configured", {
      periodType: window.periodType,
      periodKey: window.periodKey,
    });
    return false;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isSendable()) {
    logger.warn("Period awards: game channel unavailable", {
      periodType: window.periodType,
      periodKey: window.periodKey,
      channelId,
      mode,
    });
    return false;
  }

  await channel.send(formatPeriodStandingsMessage(window, standings, "results", mode));
  return true;
};

export type PeriodAwardsForTypeResult =
  | {
      status: "skipped";
      reason: "already-announced";
      window: PeriodWindow;
    }
  | {
      status: "finalized";
      window: PeriodWindow;
      awardPeriodId: string;
      announced: boolean;
      medalCount: number;
    }
  | {
      status: "announce-failed";
      window: PeriodWindow;
      awardPeriodId: string;
      medalCount: number;
    };

/** Finalize and announce the previous window for a single period type. */
export const runPeriodAwardsForType = async (
  client: Client,
  periodType: PeriodType,
  now: Date = new Date(),
  mode: GameMode = "country",
): Promise<PeriodAwardsForTypeResult> => {
  const window = getPreviousPeriodWindow(periodType, now);
  const finalized = await finalizePeriodAwards(window, mode);

  if (finalized.status === "skipped") {
    return { status: "skipped", reason: "already-announced", window };
  }

  const medalCount = finalized.standings.reduce((sum, category) => sum + category.medals.length, 0);

  const goldPlayerIds = [
    ...new Set(
      finalized.standings.flatMap((category) =>
        category.medals.filter((medal) => medal.medal === "gold").map((medal) => medal.playerId),
      ),
    ),
  ];
  if (goldPlayerIds.length > 0) {
    await onPeriodAwardsFinalized(client, periodType, goldPlayerIds, mode);
  }

  const announced = await announcePeriodResults(client, window, finalized.standings, mode);
  if (announced) {
    const marked = await markPeriodAnnounced(finalized.awardPeriodId, mode);
    if (!marked) {
      logger.warn("Period awards announced but mark did not update", {
        periodType: window.periodType,
        periodKey: window.periodKey,
        awardPeriodId: finalized.awardPeriodId,
      });
    }
    return {
      status: "finalized",
      window,
      awardPeriodId: finalized.awardPeriodId,
      announced: true,
      medalCount,
    };
  }

  logger.error("Period awards calculated but announcement failed", {
    periodType: window.periodType,
    periodKey: window.periodKey,
    awardPeriodId: finalized.awardPeriodId,
  });

  return {
    status: "announce-failed",
    window,
    awardPeriodId: finalized.awardPeriodId,
    medalCount,
  };
};

export type PeriodAwardsCheckResult = {
  finalized: PeriodType[];
  skipped: PeriodType[];
  announced: PeriodType[];
};

export const runPeriodAwardsCheck = async (
  client: Client,
  now: Date = new Date(),
  mode: GameMode = "country",
): Promise<PeriodAwardsCheckResult> => {
  const result: PeriodAwardsCheckResult = {
    finalized: [],
    skipped: [],
    announced: [],
  };

  for (const periodType of periodsToFinalize(now)) {
    const outcome = await runPeriodAwardsForType(client, periodType, now, mode);

    if (outcome.status === "skipped") {
      result.skipped.push(periodType);
      continue;
    }

    result.finalized.push(periodType);
    if (outcome.status === "finalized" && outcome.announced) {
      result.announced.push(periodType);
    }
  }

  return result;
};

export type { AwardCategory, PeriodType, PeriodWindow };
