import { sqlClient } from "../db/client.ts";
import {
  AWARD_CATEGORIES,
  assignMedals,
  type AwardCategory,
  type MedalAssignment,
  type PeriodType,
  type PeriodWindow,
  type StandingRow,
} from "../domain/awards/periods.ts";

/** postgres.js (under Bun) rejects Date params; pass ISO strings instead. */
const sqlTimestamp = (date: Date) => date.toISOString();

export const getPeriodStandings = async (
  category: AwardCategory,
  startsAt: Date,
  endsAt: Date,
  limit = 10,
): Promise<StandingRow[]> => {
  const startsAtSql = sqlTimestamp(startsAt);
  const endsAtSql = sqlTimestamp(endsAt);

  let rows: Array<{
    player_id: string;
    display_name: string;
    discord_user_id: string;
    value: number | string;
  }>;

  switch (category) {
    case "points":
      rows = await sqlClient`
        SELECT
          p.id AS player_id,
          p.display_name,
          p.discord_user_id,
          SUM(pl.points_delta)::int AS value
        FROM point_ledger pl
        JOIN game g ON g.id = pl.game_id
        JOIN player p ON p.id = pl.player_id
        WHERE g.is_test = false
          AND pl.created_at >= ${startsAtSql}
          AND pl.created_at < ${endsAtSql}
        GROUP BY p.id, p.display_name, p.discord_user_id
        HAVING SUM(pl.points_delta) > 0
        ORDER BY value DESC, p.display_name ASC
        LIMIT ${limit}
      `;
      break;
    case "wins":
      rows = await sqlClient`
        SELECT
          p.id AS player_id,
          p.display_name,
          p.discord_user_id,
          COUNT(*)::int AS value
        FROM game g
        JOIN player p ON p.id = g.winner_player_id
        WHERE g.is_test = false
          AND g.status = 'completed'
          AND g.winner_player_id IS NOT NULL
          AND g.ended_at >= ${startsAtSql}
          AND g.ended_at < ${endsAtSql}
        GROUP BY p.id, p.display_name, p.discord_user_id
        ORDER BY value DESC, p.display_name ASC
        LIMIT ${limit}
      `;
      break;
    case "started":
      rows = await sqlClient`
        SELECT
          p.id AS player_id,
          p.display_name,
          p.discord_user_id,
          COUNT(*)::int AS value
        FROM game g
        JOIN player p ON p.id = g.game_master_player_id
        WHERE g.is_test = false
          AND g.started_at >= ${startsAtSql}
          AND g.started_at < ${endsAtSql}
        GROUP BY p.id, p.display_name, p.discord_user_id
        ORDER BY value DESC, p.display_name ASC
        LIMIT ${limit}
      `;
      break;
    case "hardest":
      rows = await sqlClient`
        SELECT
          p.id AS player_id,
          p.display_name,
          p.discord_user_id,
          MAX(g.unique_wrong_country_count)::int AS value
        FROM game g
        JOIN player p ON p.id = g.game_master_player_id
        WHERE g.is_test = false
          AND g.status = 'completed'
          AND g.ended_at >= ${startsAtSql}
          AND g.ended_at < ${endsAtSql}
          AND g.unique_wrong_country_count > 0
        GROUP BY p.id, p.display_name, p.discord_user_id
        ORDER BY value DESC, p.display_name ASC
        LIMIT ${limit}
      `;
      break;
  }

  return rows.map((row) => ({
    playerId: row.player_id,
    displayName: row.display_name,
    discordUserId: row.discord_user_id,
    value: Number(row.value),
  }));
};

export type CategoryStandings = {
  category: AwardCategory;
  rows: StandingRow[];
  medals: MedalAssignment[];
};

export const getAllCategoryStandings = async (
  startsAt: Date,
  endsAt: Date,
  limit = 10,
): Promise<CategoryStandings[]> => {
  const results: CategoryStandings[] = [];
  for (const category of AWARD_CATEGORIES) {
    const rows = await getPeriodStandings(category, startsAt, endsAt, limit);
    results.push({
      category,
      rows,
      medals: assignMedals(rows),
    });
  }
  return results;
};

export type FinalizePeriodResult =
  | { status: "skipped"; reason: "already-announced" }
  | {
      status: "finalized";
      awardPeriodId: string;
      window: PeriodWindow;
      standings: CategoryStandings[];
      shouldAnnounce: boolean;
    };

export const finalizePeriodAwards = async (window: PeriodWindow): Promise<FinalizePeriodResult> => {
  const existing = await sqlClient`
    SELECT id, announced_at
    FROM award_period
    WHERE period_type = ${window.periodType}
      AND period_key = ${window.periodKey}
  `;

  if (existing[0]?.announced_at) {
    return { status: "skipped", reason: "already-announced" };
  }

  const standings = await getAllCategoryStandings(window.startsAt, window.endsAt, 10);
  const startsAtSql = sqlTimestamp(window.startsAt);
  const endsAtSql = sqlTimestamp(window.endsAt);

  const awardPeriodId = await sqlClient.begin(async (tx) => {
    const upserted = await tx`
      INSERT INTO award_period (period_type, period_key, starts_at, ends_at)
      VALUES (${window.periodType}, ${window.periodKey}, ${startsAtSql}, ${endsAtSql})
      ON CONFLICT (period_type, period_key)
      DO UPDATE SET
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        updated_at = now()
      RETURNING id, announced_at
    `;

    const period = upserted[0];
    if (!period) {
      throw new Error("Failed to upsert award_period");
    }
    if (period.announced_at) {
      return null;
    }

    await tx`
      DELETE FROM period_award
      WHERE award_period_id = ${period.id}
    `;

    for (const { category, medals } of standings) {
      for (const medal of medals) {
        await tx`
          INSERT INTO period_award (
            award_period_id,
            player_id,
            category,
            medal,
            rank_value,
            medal_points
          )
          VALUES (
            ${period.id},
            ${medal.playerId},
            ${category},
            ${medal.medal},
            ${medal.value},
            ${medal.medalPoints}
          )
        `;
      }
    }

    return period.id as string;
  });

  if (!awardPeriodId) {
    return { status: "skipped", reason: "already-announced" };
  }

  return {
    status: "finalized",
    awardPeriodId,
    window,
    standings,
    shouldAnnounce: true,
  };
};

export const markPeriodAnnounced = async (awardPeriodId: string) => {
  await sqlClient`
    UPDATE award_period
    SET announced_at = now(), updated_at = now()
    WHERE id = ${awardPeriodId}
      AND announced_at IS NULL
  `;
};

export type MedalLeaderboardRow = {
  displayName: string;
  discordUserId: string;
  medalPoints: number;
  gold: number;
  silver: number;
  bronze: number;
};

export const getMedalLeaderboard = async (limit = 10): Promise<MedalLeaderboardRow[]> => {
  const rows = await sqlClient`
    SELECT
      p.display_name,
      p.discord_user_id,
      COALESCE(SUM(pa.medal_points), 0)::int AS medal_points,
      COUNT(*) FILTER (WHERE pa.medal = 'gold')::int AS gold,
      COUNT(*) FILTER (WHERE pa.medal = 'silver')::int AS silver,
      COUNT(*) FILTER (WHERE pa.medal = 'bronze')::int AS bronze
    FROM period_award pa
    JOIN player p ON p.id = pa.player_id
    GROUP BY p.id, p.display_name, p.discord_user_id
    HAVING SUM(pa.medal_points) > 0
    ORDER BY medal_points DESC, gold DESC, silver DESC, bronze DESC, p.display_name ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    displayName: row.display_name as string,
    discordUserId: row.discord_user_id as string,
    medalPoints: Number(row.medal_points),
    gold: Number(row.gold),
    silver: Number(row.silver),
    bronze: Number(row.bronze),
  }));
};

export type { PeriodType, PeriodWindow };
