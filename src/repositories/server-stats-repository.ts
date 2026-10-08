import { sqlClient } from "../db/client.ts";
import { tablesFor, type GameMode } from "../domain/game/game-mode.ts";

export type LocationCount = { code: string; count: number };
export type NamedCount = { name: string; count: number };

/** Server-wide numbers for the `!stats` card. Test games are left out. */
export type ServerStats = {
  mode: GameMode;
  /** Start of the first real game in this mode; null before any game. */
  firstGameAt: Date | null;
  completedGames: number;
  totalGuesses: number;
  /** Players who hosted or guessed in a completed game. */
  totalPlayers: number;
  hosts: number;
  /** Player and game pairs: players per game is `participations / completedGames`. */
  participations: number;
  oneshotGames: number;
  pointsAwarded: number;
  achievementsUnlocked: number;
  /** Most guesses in one completed game. */
  hardestGameGuesses: number;
  /** Day (YYYY-MM-DD, Istanbul) with the most completed games. */
  busiestDay: { date: string; games: number } | null;
  /** Every target location, most games first. */
  locations: LocationCount[];
  /** The wrong guess players made most often. */
  mostWrongGuess: LocationCount | null;
  /** Completed games per month (YYYY-MM, Istanbul), oldest first, with empty months filled in. */
  monthly: Array<{ month: string; games: number }>;
  /** Completed games by Istanbul start hour, index 0 to 23. */
  hourly: number[];
  topWinner: NamedCount | null;
  topHost: NamedCount | null;
};

const ISTANBUL = "Europe/Istanbul";

/** Every month from `first` to `last` inclusive, as YYYY-MM. */
export const monthRange = (first: string, last: string) => {
  const months: string[] = [];
  let [year, month] = first.split("-").map(Number) as [number, number];
  while (months.length < 600) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= last) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
};

const monthKeyOf = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: ISTANBUL })
    .format(date)
    .slice(0, 7);

export const getServerStats = async (mode: GameMode, now = new Date()): Promise<ServerStats> => {
  const t = tablesFor(mode);
  const sql = sqlClient;
  const game = sql(t.game);
  const targetCode =
    mode === "province"
      ? sql`g.target_province_code`
      : sql`COALESCE(l.manual_country_code, l.country_code)`;
  const localStart = sql`(g.started_at AT TIME ZONE 'UTC' AT TIME ZONE ${ISTANBUL})`;
  const completed = sql`g.status = 'completed' AND g.is_test = false`;

  const [totals, locations, wrong, monthly, hourly, busiest, winner, host] = await Promise.all([
    sql`
      WITH done AS (SELECT * FROM ${game} g WHERE ${completed}),
      participants AS (
        SELECT gs.game_id, gs.player_id
        FROM ${sql(t.guess)} gs
        JOIN done ON done.id = gs.game_id
        WHERE gs.is_rate_limited = false
        GROUP BY 1, 2
      )
      SELECT
        (SELECT MIN(started_at) FROM ${game} WHERE is_test = false) AS first_game_at,
        (SELECT COUNT(*)::int FROM done) AS completed_games,
        (SELECT COALESCE(SUM(total_guess_count), 0)::int FROM done) AS total_guesses,
        (SELECT COALESCE(MAX(total_guess_count), 0)::int FROM done) AS hardest_game_guesses,
        (SELECT COALESCE(SUM(points_awarded), 0)::int FROM done) AS points_awarded,
        (SELECT COUNT(*)::int FROM done WHERE ${sql(t.uniqueWrongColumn)} = 0) AS oneshot_games,
        (SELECT COUNT(DISTINCT game_master_player_id)::int FROM done) AS hosts,
        (SELECT COUNT(*)::int FROM participants) AS participations,
        (
          SELECT COUNT(*)::int FROM (
            SELECT player_id FROM participants
            UNION
            SELECT game_master_player_id FROM done
          ) players
        ) AS total_players,
        (SELECT COUNT(*)::int FROM ${sql(t.playerAchievement)}) AS achievements_unlocked
    `,
    sql`
      SELECT ${targetCode} AS code, COUNT(*)::int AS count
      FROM ${game} g
      JOIN location l ON l.id = g.location_id
      WHERE ${completed}
      GROUP BY 1
      ORDER BY 2 DESC, 1 ASC
    `,
    sql`
      SELECT gs.${sql(t.parsedCodeColumn)} AS code, COUNT(*)::int AS count
      FROM ${sql(t.guess)} gs
      JOIN ${game} g ON g.id = gs.game_id
      WHERE ${completed}
        AND gs.is_correct = false
        AND gs.is_rate_limited = false
        AND gs.${sql(t.parsedCodeColumn)} IS NOT NULL
      GROUP BY 1
      ORDER BY 2 DESC, 1 ASC
      LIMIT 1
    `,
    sql`
      SELECT to_char(${localStart}, 'YYYY-MM') AS month, COUNT(*)::int AS games
      FROM ${game} g
      WHERE ${completed}
      GROUP BY 1
    `,
    sql`
      SELECT EXTRACT(HOUR FROM ${localStart})::int AS hour, COUNT(*)::int AS games
      FROM ${game} g
      WHERE ${completed}
      GROUP BY 1
    `,
    sql`
      SELECT to_char(${localStart}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS games
      FROM ${game} g
      WHERE ${completed}
      GROUP BY 1
      ORDER BY 2 DESC, 1 DESC
      LIMIT 1
    `,
    sql`
      SELECT p.display_name AS name, COUNT(*)::int AS count
      FROM ${game} g
      JOIN player p ON p.id = g.winner_player_id
      WHERE ${completed}
      GROUP BY p.id, p.display_name
      ORDER BY 2 DESC, MIN(g.ended_at) ASC
      LIMIT 1
    `,
    sql`
      SELECT p.display_name AS name, COUNT(*)::int AS count
      FROM ${game} g
      JOIN player p ON p.id = g.game_master_player_id
      WHERE ${completed}
      GROUP BY p.id, p.display_name
      ORDER BY 2 DESC, MIN(g.started_at) ASC
      LIMIT 1
    `,
  ]);

  const row = totals[0] ?? {};
  // Columns are UTC `timestamp`s that the client returns as text without a zone.
  const firstGameAt =
    row.first_game_at == null
      ? null
      : row.first_game_at instanceof Date
        ? row.first_game_at
        : new Date(`${String(row.first_game_at).replace(" ", "T")}Z`);
  const gamesByMonth = new Map(monthly.map((entry) => [String(entry.month), Number(entry.games)]));
  const gamesByHour = new Map(hourly.map((entry) => [Number(entry.hour), Number(entry.games)]));
  const named = (rows: typeof winner) =>
    rows[0] ? { name: String(rows[0].name), count: Number(rows[0].count) } : null;

  return {
    mode,
    firstGameAt,
    completedGames: Number(row.completed_games ?? 0),
    totalGuesses: Number(row.total_guesses ?? 0),
    totalPlayers: Number(row.total_players ?? 0),
    hosts: Number(row.hosts ?? 0),
    participations: Number(row.participations ?? 0),
    oneshotGames: Number(row.oneshot_games ?? 0),
    pointsAwarded: Number(row.points_awarded ?? 0),
    achievementsUnlocked: Number(row.achievements_unlocked ?? 0),
    hardestGameGuesses: Number(row.hardest_game_guesses ?? 0),
    busiestDay: busiest[0]
      ? { date: String(busiest[0].day), games: Number(busiest[0].games) }
      : null,
    locations: locations.map((entry) => ({ code: String(entry.code), count: Number(entry.count) })),
    mostWrongGuess: wrong[0]
      ? { code: String(wrong[0].code), count: Number(wrong[0].count) }
      : null,
    monthly: firstGameAt
      ? monthRange(monthKeyOf(firstGameAt), monthKeyOf(now)).map((month) => ({
          month,
          games: gamesByMonth.get(month) ?? 0,
        }))
      : [],
    hourly: Array.from({ length: 24 }, (_, hour) => gamesByHour.get(hour) ?? 0),
    topWinner: named(winner),
    topHost: named(host),
  };
};
