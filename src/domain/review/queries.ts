import { sqlClient } from "../../db/client.ts";
import { tablesFor, type GameMode } from "../game/game-mode.ts";
import {
  evaluateHostOnly,
  evaluatePair,
  FAST_MEDIAN_FRACTION,
  herfindahl,
  isFastSolve,
  MULTIPLIER_SNIPE_MIN_AGE_SECONDS,
  MULTIPLIER_SNIPE_WINDOW_SECONDS,
  REPEAT_PIN_METERS,
  shrunkRate,
  type PairVerdict,
} from "./scoring.ts";

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nullableNum = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

/** Target code: the location's country, or the plate code stored on province games. */
const targetCode = (mode: GameMode, gameAlias: string, locationAlias: string) =>
  mode === "province"
    ? sqlClient(`${gameAlias}.target_province_code`)
    : sqlClient(`${locationAlias}.country_code`);

const asBool = (value: unknown) => value === true || value === "t" || value === "true";

export type SuspectPair = {
  gmName: string;
  gmDiscordUserId: string;
  playerName: string;
  playerDiscordUserId: string;
  playedWith: number;
  winsWith: number;
  playedOther: number;
  winsOther: number;
  silentWins: number;
  fastWins: number;
  medianSolveSeconds: number | null;
  verdict: PairVerdict;
};

export type SuspectHost = {
  displayName: string;
  discordUserId: string;
  discordCreatedAt: Date | null;
  gamesStarted: number;
  gamesParticipated: number;
  gamesWon: number;
  winnerName: string;
  winnerDiscordUserId: string;
  topWins: number;
  completedHosted: number;
};

export type SuspectReport = {
  pairs: SuspectPair[];
  hosts: SuspectHost[];
  pairCount: number;
  hostCount: number;
};

const SUSPECT_PAIR_LIMIT = 15;
const SUSPECT_HOST_LIMIT = 10;

export const listSuspects = async (
  minShared: number,
  mode: GameMode = "country",
): Promise<SuspectReport> => {
  const t = tablesFor(mode);
  const rows = await sqlClient`
    WITH participation AS (
      SELECT
        g.game_master_player_id AS gm_id,
        pg.player_id,
        (g.winner_player_id = pg.player_id) AS won,
        g.id AS game_id
      FROM ${sqlClient(t.game)} g
      JOIN ${sqlClient(t.playerGame)} pg
        ON pg.game_id = g.id
       AND pg.role = 'player'
      WHERE g.status = 'completed'
        AND g.is_test = false
        AND pg.player_id <> g.game_master_player_id
    ),
    pair_played AS (
      SELECT
        gm_id,
        player_id,
        COUNT(*)::int AS played_with,
        COUNT(*) FILTER (WHERE won)::int AS wins_with
      FROM participation
      GROUP BY gm_id, player_id
    ),
    player_totals AS (
      SELECT
        player_id,
        COUNT(*)::int AS played_all,
        COUNT(*) FILTER (WHERE won)::int AS wins_all
      FROM participation
      GROUP BY player_id
    ),
    country_median AS (
      SELECT
        ${targetCode(mode, "g", "l")} AS country_code,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (
            COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
          ))
        ) AS median_seconds
      FROM ${sqlClient(t.game)} g
      JOIN location l ON l.id = g.location_id
      JOIN ${sqlClient(t.guess)} wg ON wg.id = g.winning_guess_id
      WHERE g.status = 'completed'
        AND g.is_test = false
        AND EXTRACT(EPOCH FROM (
          COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
        )) >= 0
      GROUP BY ${targetCode(mode, "g", "l")}
    ),
    pair_shape AS (
      SELECT
        g.game_master_player_id AS gm_id,
        g.winner_player_id AS player_id,
        COUNT(*) FILTER (WHERE COALESCE(pg.unique_wrong_guess_count, -1) = 0)::int AS silent_wins,
        COUNT(*) FILTER (
          WHERE EXTRACT(EPOCH FROM (
            COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
          )) >= 0
            AND cm.median_seconds > 0
            AND EXTRACT(EPOCH FROM (
              COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
            )) <= cm.median_seconds * ${FAST_MEDIAN_FRACTION}
        )::int AS fast_wins,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (
            COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
          ))
        ) FILTER (
          WHERE EXTRACT(EPOCH FROM (
            COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
          )) >= 0
        ) AS median_solve_seconds
      FROM ${sqlClient(t.game)} g
      JOIN ${sqlClient(t.guess)} wg ON wg.id = g.winning_guess_id
      LEFT JOIN ${sqlClient(t.playerGame)} pg
        ON pg.game_id = g.id
       AND pg.player_id = g.winner_player_id
       AND pg.role = 'player'
      LEFT JOIN location l ON l.id = g.location_id
      LEFT JOIN country_median cm ON cm.country_code = ${targetCode(mode, "g", "l")}
      WHERE g.status = 'completed'
        AND g.is_test = false
        AND g.winner_player_id IS NOT NULL
      GROUP BY g.game_master_player_id, g.winner_player_id
    )
    SELECT
      gm.display_name AS gm_name,
      gm.discord_user_id AS gm_discord_id,
      pl.display_name AS player_name,
      pl.discord_user_id AS player_discord_id,
      pp.played_with,
      pp.wins_with,
      (pt.played_all - pp.played_with)::int AS played_other,
      (pt.wins_all - pp.wins_with)::int AS wins_other,
      COALESCE(ps.silent_wins, 0)::int AS silent_wins,
      COALESCE(ps.fast_wins, 0)::int AS fast_wins,
      ps.median_solve_seconds
    FROM pair_played pp
    JOIN player_totals pt ON pt.player_id = pp.player_id
    JOIN player gm ON gm.id = pp.gm_id
    JOIN player pl ON pl.id = pp.player_id
    LEFT JOIN pair_shape ps ON ps.gm_id = pp.gm_id AND ps.player_id = pp.player_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM suspicion_dismissal d
      WHERE (d.player_id = pp.gm_id AND d.other_player_id = pp.player_id)
         OR (d.player_id = pp.player_id AND d.other_player_id = pp.gm_id)
    )
  `;

  const pairs = rows
    .map((row) => {
      const stats = {
        playedWith: num(row.played_with),
        winsWith: num(row.wins_with),
        playedOther: num(row.played_other),
        winsOther: num(row.wins_other),
        silentWins: num(row.silent_wins),
        fastWins: num(row.fast_wins),
      };
      return {
        gmName: String(row.gm_name),
        gmDiscordUserId: String(row.gm_discord_id),
        playerName: String(row.player_name),
        playerDiscordUserId: String(row.player_discord_id),
        ...stats,
        medianSolveSeconds: nullableNum(row.median_solve_seconds),
        verdict: evaluatePair(stats, minShared),
      };
    })
    .filter((pair) => pair.verdict.flagged)
    .sort((left, right) => {
      const lift = (value: number | undefined) =>
        value === undefined ? 0 : Number.isFinite(value) ? value : Number.MAX_VALUE;
      return (
        right.verdict.silentShare - left.verdict.silentShare ||
        lift(right.verdict.lift) - lift(left.verdict.lift) ||
        right.playedWith - left.playedWith
      );
    });

  const hostRows = await sqlClient`
    WITH hosted AS (
      SELECT
        g.game_master_player_id AS gm_id,
        g.winner_player_id AS winner_id,
        COUNT(*)::int AS wins
      FROM ${sqlClient(t.game)} g
      WHERE g.status = 'completed'
        AND g.is_test = false
        AND g.winner_player_id IS NOT NULL
      GROUP BY g.game_master_player_id, g.winner_player_id
    ),
    top_winner AS (
      SELECT DISTINCT ON (gm_id) gm_id, winner_id, wins
      FROM hosted
      ORDER BY gm_id, wins DESC, winner_id
    ),
    hosted_count AS (
      SELECT gm_id, SUM(wins)::int AS completed
      FROM hosted
      GROUP BY gm_id
    )
    SELECT
      p.display_name,
      p.discord_user_id,
      p.discord_created_at,
      ps.games_started,
      ps.games_participated,
      ps.games_won,
      wp.display_name AS winner_name,
      wp.discord_user_id AS winner_discord_id,
      tw.wins AS top_wins,
      hc.completed
    FROM ${sqlClient(t.playerStat)} ps
    JOIN player p ON p.id = ps.player_id
    JOIN top_winner tw ON tw.gm_id = p.id
    JOIN player wp ON wp.id = tw.winner_id
    JOIN hosted_count hc ON hc.gm_id = p.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM suspicion_dismissal d
      WHERE (d.player_id = p.id AND d.other_player_id = tw.winner_id)
         OR (d.player_id = tw.winner_id AND d.other_player_id = p.id)
    )
  `;

  const hosts = hostRows
    .map((row) => ({
      displayName: String(row.display_name),
      discordUserId: String(row.discord_user_id),
      discordCreatedAt: asDate(row.discord_created_at),
      gamesStarted: num(row.games_started),
      gamesParticipated: num(row.games_participated),
      gamesWon: num(row.games_won),
      winnerName: String(row.winner_name),
      winnerDiscordUserId: String(row.winner_discord_id),
      topWins: num(row.top_wins),
      completedHosted: num(row.completed),
    }))
    .filter((host) =>
      evaluateHostOnly(
        {
          gamesStarted: host.gamesStarted,
          gamesParticipated: host.gamesParticipated,
          gamesWon: host.gamesWon,
          completedHosted: host.completedHosted,
          topWinnerWins: host.topWins,
        },
        minShared,
      ),
    )
    .sort(
      (left, right) =>
        right.topWins / right.completedHosted - left.topWins / left.completedHosted ||
        right.topWins - left.topWins,
    );

  return {
    pairs: pairs.slice(0, SUSPECT_PAIR_LIMIT),
    hosts: hosts.slice(0, SUSPECT_HOST_LIMIT),
    pairCount: pairs.length,
    hostCount: hosts.length,
  };
};

export type PairGameRow = {
  gameId: string;
  startedAt: Date;
  gmName: string;
  gmDiscordUserId: string;
  winnerName: string | null;
  winnerDiscordUserId: string | null;
  countryCode: string;
  solveSeconds: number | null;
  countryMedianSeconds: number | null;
  silent: boolean;
  fast: boolean;
  multiplierSnipe: boolean;
  repeatPin: boolean;
  startSource: string | null;
};

export const listPairGames = async (
  playerA: string,
  playerB: string,
  mode: GameMode = "country",
): Promise<PairGameRow[]> => {
  const t = tablesFor(mode);
  const rows = await sqlClient`
    WITH country_median AS (
      SELECT
        ${targetCode(mode, "g", "l")} AS country_code,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (
            COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
          ))
        ) AS median_seconds
      FROM ${sqlClient(t.game)} g
      JOIN location l ON l.id = g.location_id
      JOIN ${sqlClient(t.guess)} wg ON wg.id = g.winning_guess_id
      WHERE g.status = 'completed'
        AND g.is_test = false
        AND EXTRACT(EPOCH FROM (
          COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
        )) >= 0
      GROUP BY ${targetCode(mode, "g", "l")}
    )
    SELECT
      g.id,
      g.started_at,
      gm.display_name AS gm_name,
      gm.discord_user_id AS gm_discord_id,
      winner.display_name AS winner_name,
      winner.discord_user_id AS winner_discord_id,
      ${targetCode(mode, "g", "l")} AS country_code,
      g.start_source,
      (g.winner_player_id IN (${playerA}::uuid, ${playerB}::uuid)) AS pair_won,
      EXTRACT(EPOCH FROM (
        COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
      )) AS solve_seconds,
      cm.median_seconds,
      (
        g.winner_player_id IN (${playerA}::uuid, ${playerB}::uuid)
        AND COALESCE(pg.unique_wrong_guess_count, -1) = 0
      ) AS silent,
      (
        EXTRACT(EPOCH FROM (
          COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
        )) >= ${MULTIPLIER_SNIPE_MIN_AGE_SECONDS}
        AND COALESCE(pg.unique_wrong_guess_count, -1) = 0
        AND g.winner_player_id IN (${playerA}::uuid, ${playerB}::uuid)
        AND EXISTS (
          SELECT 1
          FROM ${sqlClient(t.multiplierEvent)} me
          WHERE me.game_id = g.id
            AND COALESCE(wg.sent_at, wg.created_at) >= me.created_at
            AND COALESCE(wg.sent_at, wg.created_at)
              < me.created_at + make_interval(secs => ${MULTIPLIER_SNIPE_WINDOW_SECONDS})
        )
      ) AS multiplier_snipe,
      EXISTS (
        SELECT 1
        FROM ${sqlClient(t.game)} earlier
        JOIN location earlier_location ON earlier_location.id = earlier.location_id
        WHERE earlier.id <> g.id
          AND earlier.status = 'completed'
          AND earlier.is_test = false
          AND earlier.started_at < g.started_at
          AND earlier_location.latitude BETWEEN l.latitude - 0.01 AND l.latitude + 0.01
          AND earlier_location.longitude BETWEEN l.longitude - 0.01 AND l.longitude + 0.01
          AND (
            6371000 * 2 * asin(sqrt(
              power(sin(radians(l.latitude - earlier_location.latitude) / 2), 2)
              + cos(radians(earlier_location.latitude)) * cos(radians(l.latitude))
              * power(sin(radians(l.longitude - earlier_location.longitude) / 2), 2)
            ))
          ) < ${REPEAT_PIN_METERS}
      ) AS repeat_pin
    FROM ${sqlClient(t.game)} g
    JOIN location l ON l.id = g.location_id
    JOIN player gm ON gm.id = g.game_master_player_id
    LEFT JOIN player winner ON winner.id = g.winner_player_id
    LEFT JOIN ${sqlClient(t.guess)} wg ON wg.id = g.winning_guess_id
    LEFT JOIN ${sqlClient(t.playerGame)} pg
      ON pg.game_id = g.id
     AND pg.player_id = g.winner_player_id
     AND pg.role = 'player'
    LEFT JOIN country_median cm ON cm.country_code = ${targetCode(mode, "g", "l")}
    WHERE g.status = 'completed'
      AND g.is_test = false
      AND (
        (
          g.game_master_player_id = ${playerA}::uuid
          AND EXISTS (
            SELECT 1 FROM ${sqlClient(t.playerGame)} participant
            WHERE participant.game_id = g.id
              AND participant.player_id = ${playerB}::uuid
              AND participant.role = 'player'
          )
        )
        OR (
          g.game_master_player_id = ${playerB}::uuid
          AND EXISTS (
            SELECT 1 FROM ${sqlClient(t.playerGame)} participant
            WHERE participant.game_id = g.id
              AND participant.player_id = ${playerA}::uuid
              AND participant.role = 'player'
          )
        )
      )
    ORDER BY g.started_at DESC
    LIMIT 30
  `;

  return rows.map((row) => {
    const solveSeconds = nullableNum(row.solve_seconds);
    const countryMedianSeconds = nullableNum(row.median_seconds);
    return {
      gameId: String(row.id),
      startedAt: asDate(row.started_at) ?? new Date(0),
      gmName: String(row.gm_name),
      gmDiscordUserId: String(row.gm_discord_id),
      winnerName: row.winner_name == null ? null : String(row.winner_name),
      winnerDiscordUserId: row.winner_discord_id == null ? null : String(row.winner_discord_id),
      countryCode: String(row.country_code),
      solveSeconds,
      countryMedianSeconds,
      silent: asBool(row.silent),
      fast: asBool(row.pair_won) && isFastSolve(solveSeconds, countryMedianSeconds),
      multiplierSnipe: asBool(row.multiplier_snipe),
      repeatPin: asBool(row.repeat_pin),
      startSource: row.start_source == null ? null : String(row.start_source),
    };
  });
};

export type PlayerGmWin = {
  displayName: string;
  discordUserId: string;
  wins: number;
};

export type PlayerReview = {
  displayName: string;
  discordUserId: string;
  discordCreatedAt: Date | null;
  gamesWon: number;
  gamesParticipated: number;
  priorRate: number;
  shrunk: number;
  firstCorrect: number;
  firstGames: number;
  concentration: number;
  /** Wins grouped by host, before the display cap. */
  winTotal: number;
  hosts: PlayerGmWin[];
};

export const getPlayerReview = async (
  playerId: string,
  mode: GameMode = "country",
): Promise<PlayerReview | undefined> => {
  const t = tablesFor(mode);
  const players = await sqlClient`
    SELECT
      p.display_name,
      p.discord_user_id,
      p.discord_created_at,
      COALESCE(ps.games_won, 0)::int AS games_won,
      COALESCE(ps.games_participated, 0)::int AS games_participated
    FROM player p
    LEFT JOIN ${sqlClient(t.playerStat)} ps ON ps.player_id = p.id
    WHERE p.id = ${playerId}::uuid
  `;
  const player = players[0];
  if (!player) {
    return undefined;
  }

  const priors = await sqlClient`
    SELECT
      COUNT(*) FILTER (WHERE g.winner_player_id = pg.player_id)::int AS wins,
      COUNT(*)::int AS played
    FROM ${sqlClient(t.playerGame)} pg
    JOIN ${sqlClient(t.game)} g ON g.id = pg.game_id
    WHERE pg.role = 'player'
      AND g.status = 'completed'
      AND g.is_test = false
  `;
  const priorPlayed = num(priors[0]?.played);
  const priorRate = priorPlayed === 0 ? 0 : num(priors[0]?.wins) / priorPlayed;

  const firsts = await sqlClient`
    WITH firsts AS (
      SELECT DISTINCT ON (g.game_id) g.is_correct
      FROM ${sqlClient(t.guess)} g
      JOIN ${sqlClient(t.game)} ga ON ga.id = g.game_id
      WHERE g.player_id = ${playerId}::uuid
        AND ga.is_test = false
        AND g.is_rate_limited = false
        AND g.is_repeat = false
      ORDER BY g.game_id, COALESCE(g.sent_at, g.created_at), g.created_at
    )
    SELECT
      COUNT(*)::int AS games,
      COUNT(*) FILTER (WHERE is_correct)::int AS first_correct
    FROM firsts
  `;

  const hostRows = await sqlClient`
    SELECT gm.display_name, gm.discord_user_id, COUNT(*)::int AS wins
    FROM ${sqlClient(t.game)} g
    JOIN player gm ON gm.id = g.game_master_player_id
    WHERE g.winner_player_id = ${playerId}::uuid
      AND g.status = 'completed'
      AND g.is_test = false
    GROUP BY gm.id, gm.display_name, gm.discord_user_id
    ORDER BY wins DESC, gm.display_name
  `;
  const hosts = hostRows.map((row) => ({
    displayName: String(row.display_name),
    discordUserId: String(row.discord_user_id),
    wins: num(row.wins),
  }));
  const wins = num(player.games_won);
  const played = num(player.games_participated);

  return {
    displayName: String(player.display_name),
    discordUserId: String(player.discord_user_id),
    discordCreatedAt: asDate(player.discord_created_at),
    gamesWon: wins,
    gamesParticipated: played,
    priorRate,
    shrunk: shrunkRate(wins, played, priorRate),
    firstCorrect: num(firsts[0]?.first_correct),
    firstGames: num(firsts[0]?.games),
    concentration: herfindahl(hosts.map((host) => host.wins)),
    winTotal: hosts.reduce((sum, host) => sum + host.wins, 0),
    hosts: hosts.slice(0, 8),
  };
};

export type GameGuessRow = {
  displayName: string;
  discordUserId: string;
  countryCode: string | null;
  rawMessage: string;
  isCorrect: boolean;
  isRepeat: boolean;
  isRateLimited: boolean;
  seconds: number | null;
};

export type GameReview = {
  id: string;
  status: string;
  startSource: string | null;
  gmName: string;
  gmDiscordUserId: string;
  winnerName: string | null;
  winnerDiscordUserId: string | null;
  countryCode: string;
  countryName: string | null;
  usedStartFallback: boolean;
  solveSeconds: number | null;
  countryMedianSeconds: number | null;
  winnerUniqueWrong: number | null;
  guesses: GameGuessRow[];
  truncated: boolean;
};

const GAME_GUESS_LIMIT = 60;

export const getGameReview = async (
  gameId: string,
  mode: GameMode = "country",
): Promise<GameReview | undefined> => {
  const t = tablesFor(mode);
  const games = await sqlClient`
    SELECT
      g.id,
      g.status,
      g.start_source,
      g.announced_at,
      gm.display_name AS gm_name,
      gm.discord_user_id AS gm_discord_id,
      winner.display_name AS winner_name,
      winner.discord_user_id AS winner_discord_id,
      ${targetCode(mode, "g", "l")} AS country_code,
      l.country_name,
      EXTRACT(EPOCH FROM (
        COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
      )) AS solve_seconds,
      pg.unique_wrong_guess_count AS winner_unique_wrong,
      (
        SELECT percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (
            COALESCE(other_guess.sent_at, other_guess.created_at)
            - COALESCE(other_game.announced_at, other_game.started_at)
          ))
        )
        FROM ${sqlClient(t.game)} other_game
        JOIN location other_location ON other_location.id = other_game.location_id
        JOIN ${sqlClient(t.guess)} other_guess ON other_guess.id = other_game.winning_guess_id
        WHERE other_game.status = 'completed'
          AND other_game.is_test = false
          AND ${targetCode(mode, "other_game", "other_location")} = ${targetCode(mode, "g", "l")}
          AND EXTRACT(EPOCH FROM (
            COALESCE(other_guess.sent_at, other_guess.created_at)
            - COALESCE(other_game.announced_at, other_game.started_at)
          )) >= 0
      ) AS median_seconds
    FROM ${sqlClient(t.game)} g
    JOIN location l ON l.id = g.location_id
    JOIN player gm ON gm.id = g.game_master_player_id
    LEFT JOIN player winner ON winner.id = g.winner_player_id
    LEFT JOIN ${sqlClient(t.guess)} wg ON wg.id = g.winning_guess_id
    LEFT JOIN ${sqlClient(t.playerGame)} pg
      ON pg.game_id = g.id
     AND pg.player_id = g.winner_player_id
     AND pg.role = 'player'
    WHERE g.id = ${gameId}::uuid
      AND g.is_test = false
  `;
  const game = games[0];
  if (!game) {
    return undefined;
  }

  const guessRows = await sqlClient`
    SELECT
      p.display_name,
      p.discord_user_id,
      g.${sqlClient(t.parsedCodeColumn)} AS parsed_country_code,
      g.raw_message,
      g.is_correct,
      g.is_repeat,
      g.is_rate_limited,
      EXTRACT(EPOCH FROM (
        COALESCE(g.sent_at, g.created_at) - COALESCE(ga.announced_at, ga.started_at)
      )) AS seconds
    FROM ${sqlClient(t.guess)} g
    JOIN ${sqlClient(t.game)} ga ON ga.id = g.game_id
    JOIN player p ON p.id = g.player_id
    WHERE g.game_id = ${gameId}::uuid
    ORDER BY COALESCE(g.sent_at, g.created_at), g.created_at
    LIMIT ${GAME_GUESS_LIMIT + 1}
  `;

  return {
    id: String(game.id),
    status: String(game.status),
    startSource: game.start_source == null ? null : String(game.start_source),
    gmName: String(game.gm_name),
    gmDiscordUserId: String(game.gm_discord_id),
    winnerName: game.winner_name == null ? null : String(game.winner_name),
    winnerDiscordUserId: game.winner_discord_id == null ? null : String(game.winner_discord_id),
    countryCode: String(game.country_code),
    countryName: game.country_name == null ? null : String(game.country_name),
    usedStartFallback: game.announced_at == null,
    solveSeconds: nullableNum(game.solve_seconds),
    countryMedianSeconds: nullableNum(game.median_seconds),
    winnerUniqueWrong: game.winner_unique_wrong == null ? null : num(game.winner_unique_wrong),
    guesses: guessRows.slice(0, GAME_GUESS_LIMIT).map((row) => ({
      displayName: String(row.display_name),
      discordUserId: String(row.discord_user_id),
      countryCode: row.parsed_country_code == null ? null : String(row.parsed_country_code),
      rawMessage: String(row.raw_message),
      isCorrect: asBool(row.is_correct),
      isRepeat: asBool(row.is_repeat),
      isRateLimited: asBool(row.is_rate_limited),
      seconds: nullableNum(row.seconds),
    })),
    truncated: guessRows.length > GAME_GUESS_LIMIT,
  };
};

export type FastWinRow = {
  gameId: string;
  startedAt: Date;
  gmName: string;
  gmDiscordUserId: string;
  winnerName: string;
  winnerDiscordUserId: string;
  countryCode: string;
  solveSeconds: number;
  countryMedianSeconds: number | null;
  silent: boolean;
  dismissed: boolean;
};

export const listFastWins = async (
  maxSeconds: number,
  mode: GameMode = "country",
): Promise<FastWinRow[]> => {
  const t = tablesFor(mode);
  const rows = await sqlClient`
    WITH solved AS (
      SELECT
        g.id,
        g.started_at,
        g.game_master_player_id,
        g.winner_player_id,
        ${targetCode(mode, "g", "l")} AS country_code,
        EXTRACT(EPOCH FROM (
          COALESCE(wg.sent_at, wg.created_at) - COALESCE(g.announced_at, g.started_at)
        )) AS solve_seconds,
        COALESCE(pg.unique_wrong_guess_count, -1) = 0 AS silent
      FROM ${sqlClient(t.game)} g
      JOIN location l ON l.id = g.location_id
      JOIN ${sqlClient(t.guess)} wg ON wg.id = g.winning_guess_id
      LEFT JOIN ${sqlClient(t.playerGame)} pg
        ON pg.game_id = g.id
       AND pg.player_id = g.winner_player_id
       AND pg.role = 'player'
      WHERE g.status = 'completed'
        AND g.is_test = false
    ),
    country_median AS (
      SELECT country_code, percentile_cont(0.5) WITHIN GROUP (ORDER BY solve_seconds) AS median_seconds
      FROM solved
      WHERE solve_seconds >= 0
      GROUP BY country_code
    )
    SELECT
      solved.id,
      solved.started_at,
      gm.display_name AS gm_name,
      gm.discord_user_id AS gm_discord_id,
      winner.display_name AS winner_name,
      winner.discord_user_id AS winner_discord_id,
      solved.country_code,
      solved.solve_seconds,
      cm.median_seconds,
      solved.silent,
      EXISTS (
        SELECT 1
        FROM suspicion_dismissal d
        WHERE (d.player_id = solved.game_master_player_id AND d.other_player_id = solved.winner_player_id)
           OR (d.player_id = solved.winner_player_id AND d.other_player_id = solved.game_master_player_id)
      ) AS dismissed
    FROM solved
    JOIN player gm ON gm.id = solved.game_master_player_id
    JOIN player winner ON winner.id = solved.winner_player_id
    LEFT JOIN country_median cm ON cm.country_code = solved.country_code
    WHERE solved.solve_seconds >= 0
      AND solved.solve_seconds <= ${maxSeconds}
    ORDER BY solved.solve_seconds ASC, solved.started_at DESC
    LIMIT 25
  `;

  return rows.map((row) => ({
    gameId: String(row.id),
    startedAt: asDate(row.started_at) ?? new Date(0),
    gmName: String(row.gm_name),
    gmDiscordUserId: String(row.gm_discord_id),
    winnerName: String(row.winner_name),
    winnerDiscordUserId: String(row.winner_discord_id),
    countryCode: String(row.country_code),
    solveSeconds: num(row.solve_seconds),
    countryMedianSeconds: nullableNum(row.median_seconds),
    silent: asBool(row.silent),
    dismissed: asBool(row.dismissed),
  }));
};

export const dismissReviewPair = async (
  playerA: string,
  playerB: string,
  dismissedByDiscordUserId: string,
): Promise<"created" | "exists"> => {
  const rows = await sqlClient`
    INSERT INTO suspicion_dismissal (player_id, other_player_id, dismissed_by_discord_user_id)
    VALUES (
      LEAST(${playerA}::uuid, ${playerB}::uuid),
      GREATEST(${playerA}::uuid, ${playerB}::uuid),
      ${dismissedByDiscordUserId}
    )
    ON CONFLICT (player_id, other_player_id) DO NOTHING
    RETURNING id
  `;
  return rows[0] ? "created" : "exists";
};
