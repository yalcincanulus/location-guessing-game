import { sqlClient } from "../db/client.ts";

export type GameRules = {
  id: string;
  verifiedRoleId?: string;
  verifiedRoleName: string;
  gameChannelId?: string;
  logChannelId?: string;
  commandPrefixes: string[];
  maxConsecutiveGuesses: number;
  consecutiveGuessIdleResetSeconds: number;
  pendingStartTtlSeconds: number;
  startReservationSeconds: number;
  baseWinPoints: number;
  currentMultiplierMax: number;
  gmMultiplierMax: number;
  idleMultiplierIntervalSeconds: number;
  idleMultiplierIncrement: number;
  repeatGuessCountsForStats: boolean;
  repeatGuessCountsForGmDifficulty: boolean;
  queueGameStarts: boolean;
  testModeEnabled: boolean;
  testChannelId?: string;
  testAdminUserIds: string[];
};

let cachedRules: { expiresAt: number; value: GameRules } | undefined;

const numberValue = (value: unknown) => Number(value);

const stringArrayValue = (value: unknown, fallback: string[]) => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : fallback;
    } catch {
      return fallback;
    }
  }

  return fallback;
};

export const loadRules = async (force = false): Promise<GameRules> => {
  if (!force && cachedRules && cachedRules.expiresAt > Date.now()) {
    return cachedRules.value;
  }

  const rows = await sqlClient`
    SELECT
      id,
      verified_role_id,
      verified_role_name,
      game_channel_id,
      log_channel_id,
      command_prefixes,
      max_consecutive_guesses,
      consecutive_guess_idle_reset_seconds,
      pending_start_ttl_seconds,
      start_reservation_seconds,
      base_win_points,
      current_multiplier_max,
      gm_multiplier_max,
      idle_multiplier_interval_seconds,
      idle_multiplier_increment,
      repeat_guess_counts_for_stats,
      repeat_guess_counts_for_gm_difficulty,
      queue_game_starts,
      test_mode_enabled,
      test_channel_id,
      test_admin_user_ids
    FROM rule
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("rule table is empty; run migrations first");
  }

  const value: GameRules = {
    id: row.id,
    verifiedRoleId: row.verified_role_id ?? undefined,
    verifiedRoleName: row.verified_role_name,
    gameChannelId: row.game_channel_id ?? undefined,
    logChannelId: row.log_channel_id ?? undefined,
    commandPrefixes: stringArrayValue(row.command_prefixes, ["!"]),
    maxConsecutiveGuesses: row.max_consecutive_guesses,
    consecutiveGuessIdleResetSeconds: row.consecutive_guess_idle_reset_seconds,
    pendingStartTtlSeconds: row.pending_start_ttl_seconds,
    startReservationSeconds: row.start_reservation_seconds,
    baseWinPoints: row.base_win_points,
    currentMultiplierMax: numberValue(row.current_multiplier_max),
    gmMultiplierMax: numberValue(row.gm_multiplier_max),
    idleMultiplierIntervalSeconds: row.idle_multiplier_interval_seconds,
    idleMultiplierIncrement: numberValue(row.idle_multiplier_increment),
    repeatGuessCountsForStats: row.repeat_guess_counts_for_stats,
    repeatGuessCountsForGmDifficulty: row.repeat_guess_counts_for_gm_difficulty,
    queueGameStarts: row.queue_game_starts,
    testModeEnabled: row.test_mode_enabled,
    testChannelId: row.test_channel_id ?? undefined,
    testAdminUserIds: stringArrayValue(row.test_admin_user_ids, []),
  };

  cachedRules = { value, expiresAt: Date.now() + 30_000 };
  return value;
};

export const updateMaxConsecutiveGuesses = async (maxConsecutiveGuesses: number) => {
  await sqlClient`
    UPDATE rule
    SET
      max_consecutive_guesses = ${maxConsecutiveGuesses},
      updated_at = now()
  `;
  return loadRules(true);
};

export const isTestChannel = (_guildId: string, channelId: string, rules: GameRules) =>
  rules.testModeEnabled && rules.testChannelId === channelId;

export const isTestAdmin = (discordUserId: string, rules: GameRules) =>
  rules.testAdminUserIds.includes(discordUserId);
