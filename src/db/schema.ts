import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  integer,
  jsonb,
  numeric,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
};

export const rule = snakeCase.table("rule", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  verifiedRoleId: text(),
  verifiedRoleName: text().notNull().default("verified"),
  gameChannelId: text(),
  logChannelId: text(),
  commandPrefixes: jsonb()
    .$type<string[]>()
    .notNull()
    .default(sql`'["!"]'::jsonb`),
  maxConsecutiveGuesses: integer().notNull().default(6),
  consecutiveGuessIdleResetSeconds: integer().notNull().default(1800),
  pendingStartTtlSeconds: integer().notNull().default(1800),
  startReservationSeconds: integer().notNull().default(60),
  baseWinPoints: integer().notNull().default(100),
  currentMultiplierMax: numeric({ precision: 6, scale: 2 }).notNull().default("2.00"),
  gmMultiplierMax: numeric({ precision: 6, scale: 2 }).notNull().default("3.00"),
  idleMultiplierIntervalSeconds: integer().notNull().default(900),
  idleMultiplierIncrement: numeric({ precision: 6, scale: 2 }).notNull().default("0.10"),
  longGameMultiplierIncrement: numeric({ precision: 6, scale: 2 }).notNull().default("0.10"),
  oneShotBonus: numeric({ precision: 6, scale: 2 }).notNull().default("0.00"),
  repeatGuessCountsForStats: boolean().notNull().default(true),
  repeatGuessCountsForGmDifficulty: boolean().notNull().default(false),
  queueGameStarts: boolean().notNull().default(false),
  /** When false, new games cannot be started. A game already in progress keeps running. */
  gameStartsEnabled: boolean().notNull().default(true),
  /** Channel for Turkish province games. Province mode is off while this is null. */
  provinceGameChannelId: text(),
  /** Same as `gameStartsEnabled`, for province games only. */
  provinceGameStartsEnabled: boolean().notNull().default(true),
  testModeEnabled: boolean().notNull().default(false),
  testChannelId: text(),
  /** Test channel for province games. Uses `testModeEnabled` and `testAdminUserIds` too. */
  provinceTestChannelId: text(),
  testAdminUserIds: jsonb()
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  nominatimEmail: text(),
  ...timestamps,
});

export const guild = snakeCase.table("guild", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  discordGuildId: text().notNull().unique(),
  name: text().notNull(),
  ...timestamps,
});

export const channel = snakeCase.table("channel", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  guildId: uuid().references(() => guild.id),
  discordChannelId: text().notNull().unique(),
  name: text().notNull(),
  kind: varchar({ length: 32 }).notNull().default("game"),
  ...timestamps,
});

export const player = snakeCase.table("player", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  discordUserId: text().notNull().unique(),
  displayName: text().notNull(),
  discordCreatedAt: timestamp(),
  firstSeenAt: timestamp().notNull().defaultNow(),
  lastSeenAt: timestamp().notNull().defaultNow(),
  ...timestamps,
});

export const feedback = snakeCase.table("feedback", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  playerId: uuid()
    .notNull()
    .references(() => player.id),
  discordMessageId: text().notNull().unique(),
  message: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const location = snakeCase.table("location", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  originalGoogleMapsUrl: text().notNull(),
  resolvedGoogleMapsUrl: text(),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  coordinateSource: text().notNull(),
  countryCode: varchar({ length: 2 }).notNull(),
  countryName: text(),
  regionName: text(),
  regionCode: text(),
  nominatimPlaceId: text(),
  nominatimOsmType: text(),
  nominatimOsmId: text(),
  nominatimRawJson: jsonb(),
  manualCountryCode: varchar({ length: 2 }),
  manualRegionName: text(),
  isManuallyCorrected: boolean().notNull().default(false),
  ...timestamps,
});

export const game = snakeCase.table(
  "game",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    guildId: uuid().references(() => guild.id),
    channelId: uuid().references(() => channel.id),
    gameMasterPlayerId: uuid()
      .notNull()
      .references(() => player.id),
    locationId: uuid()
      .notNull()
      .references(() => location.id),
    status: varchar({ length: 32 }).notNull().default("active"),
    screenshotUrl: text().notNull(),
    screenshotMessageId: text(),
    announcementMessageId: text(),
    startedAt: timestamp().notNull().defaultNow(),
    endedAt: timestamp(),
    winnerPlayerId: uuid().references(() => player.id),
    winningGuessId: uuid(),
    wrongGuessCount: integer().notNull().default(0),
    uniqueWrongCountryCount: integer().notNull().default(0),
    totalGuessCount: integer().notNull().default(0),
    repeatGuessCount: integer().notNull().default(0),
    basePoints: integer().notNull().default(100),
    currentMultiplierFinal: numeric({ precision: 6, scale: 2 }).notNull().default("1.00"),
    gmMultiplierAtStart: numeric({ precision: 6, scale: 2 }).notNull().default("1.00"),
    pointsAwarded: integer().notNull().default(0),
    isTest: boolean().notNull().default(false),
    /** `dm`, `channel`, or `hybrid`. Null on games started before this column existed. */
    startSource: varchar({ length: 16 }),
    announcedAt: timestamp(),
    cancelReason: text(),
    cancelledByPlayerId: uuid().references(() => player.id),
    ...timestamps,
  },
  (table) => [
    check(
      "game_start_source_known",
      sql`${table.startSource} IS NULL OR ${table.startSource} IN ('dm', 'channel', 'hybrid')`,
    ),
  ],
);

export const guess = snakeCase.table("guess", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  gameId: uuid()
    .notNull()
    .references(() => game.id),
  playerId: uuid()
    .notNull()
    .references(() => player.id),
  discordMessageId: text().notNull(),
  rawMessage: text().notNull(),
  parsedCountryCode: varchar({ length: 2 }),
  parsedCountryName: text(),
  parserStrategy: text(),
  isCorrect: boolean().notNull().default(false),
  isRepeat: boolean().notNull().default(false),
  isRateLimited: boolean().notNull().default(false),
  reaction: text(),
  /** Discord message time, decoded from the snowflake. */
  sentAt: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const playerGame = snakeCase.table(
  "player_game",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    playerId: uuid()
      .notNull()
      .references(() => player.id),
    gameId: uuid()
      .notNull()
      .references(() => game.id),
    role: varchar({ length: 32 }).notNull().default("player"),
    guessCount: integer().notNull().default(0),
    uniqueWrongGuessCount: integer().notNull().default(0),
    repeatGuessCount: integer().notNull().default(0),
    firstGuessAt: timestamp(),
    lastGuessAt: timestamp(),
    ...timestamps,
  },
  (table) => [uniqueIndex("player_game_unique").on(table.playerId, table.gameId, table.role)],
);

export const playerStat = snakeCase.table("player_stat", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  playerId: uuid()
    .notNull()
    .references(() => player.id)
    .unique(),
  gamesStarted: integer().notNull().default(0),
  gamesParticipated: integer().notNull().default(0),
  gamesWon: integer().notNull().default(0),
  totalGuesses: integer().notNull().default(0),
  correctGuesses: integer().notNull().default(0),
  wrongGuesses: integer().notNull().default(0),
  repeatGuesses: integer().notNull().default(0),
  pointsTotal: integer().notNull().default(0),
  bestSingleGamePoints: integer().notNull().default(0),
  currentGmMultiplier: numeric({ precision: 6, scale: 2 }).notNull().default("1.00"),
  maxGameWrongGuessCountAsGm: integer().notNull().default(0),
  ...timestamps,
});

export const countryStat = snakeCase.table("country_stat", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  countryCode: varchar({ length: 2 }).notNull().unique(),
  timesUsedAsTarget: integer().notNull().default(0),
  timesGuessed: integer().notNull().default(0),
  timesGuessedWrong: integer().notNull().default(0),
  timesGuessedCorrect: integer().notNull().default(0),
  ...timestamps,
});

export const gameMasterMilestone = snakeCase.table(
  "game_master_milestone",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    playerId: uuid()
      .notNull()
      .references(() => player.id),
    milestoneGuessCount: integer().notNull(),
    gameId: uuid()
      .notNull()
      .references(() => game.id),
    earnedMultiplierIncrement: numeric({ precision: 6, scale: 2 }).notNull().default("0.10"),
    earnedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("game_master_milestone_unique").on(table.playerId, table.milestoneGuessCount),
  ],
);

export const pointLedger = snakeCase.table("point_ledger", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  playerId: uuid()
    .notNull()
    .references(() => player.id),
  gameId: uuid()
    .notNull()
    .references(() => game.id),
  reason: text().notNull(),
  basePoints: integer().notNull(),
  currentMultiplier: numeric({ precision: 6, scale: 2 }).notNull(),
  gmMultiplier: numeric({ precision: 6, scale: 2 }).notNull(),
  pointsDelta: integer().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const multiplierEvent = snakeCase.table("multiplier_event", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  gameId: uuid()
    .notNull()
    .references(() => game.id),
  kind: varchar({ length: 32 }).notNull(),
  previousMultiplier: numeric({ precision: 6, scale: 2 }).notNull(),
  increment: numeric({ precision: 6, scale: 2 }).notNull(),
  newMultiplier: numeric({ precision: 6, scale: 2 }).notNull(),
  messageId: text(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const commandLog = snakeCase.table("command_log", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  guildId: uuid().references(() => guild.id),
  channelId: uuid().references(() => channel.id),
  playerId: uuid().references(() => player.id),
  command: text().notNull(),
  rawMessage: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const startAttempt = snakeCase.table("start_attempt", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  guildId: uuid().references(() => guild.id),
  channelId: uuid().references(() => channel.id),
  playerId: uuid().references(() => player.id),
  status: varchar({ length: 32 }).notNull(),
  reason: text(),
  originalGoogleMapsUrl: text(),
  screenshotUrl: text(),
  createdAt: timestamp().notNull().defaultNow(),
});

/** Admin-only. An unordered pair the admin has cleared from the review list. */
export const suspicionDismissal = snakeCase.table(
  "suspicion_dismissal",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    playerId: uuid()
      .notNull()
      .references(() => player.id),
    otherPlayerId: uuid()
      .notNull()
      .references(() => player.id),
    dismissedByDiscordUserId: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("suspicion_dismissal_pair_unique").on(table.playerId, table.otherPlayerId),
    check("suspicion_dismissal_ordered", sql`${table.playerId} < ${table.otherPlayerId}`),
  ],
);

export const awardPeriod = snakeCase.table(
  "award_period",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    periodType: varchar({ length: 32 }).notNull(),
    periodKey: text().notNull(),
    startsAt: timestamp().notNull(),
    endsAt: timestamp().notNull(),
    announcedAt: timestamp(),
    ...timestamps,
  },
  (table) => [uniqueIndex("award_period_type_key_unique").on(table.periodType, table.periodKey)],
);

export const periodAward = snakeCase.table(
  "period_award",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    awardPeriodId: uuid()
      .notNull()
      .references(() => awardPeriod.id),
    playerId: uuid()
      .notNull()
      .references(() => player.id),
    category: varchar({ length: 32 }).notNull(),
    medal: varchar({ length: 16 }).notNull(),
    rankValue: integer().notNull(),
    medalPoints: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("period_award_period_category_player_unique").on(
      table.awardPeriodId,
      table.category,
      table.playerId,
    ),
  ],
);

export const playerAchievement = snakeCase.table(
  "player_achievement",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    playerId: uuid()
      .notNull()
      .references(() => player.id),
    achievementId: text().notNull(),
    /** Ladder threshold, or `0` for oneshots. */
    tier: integer().notNull().default(0),
    earnedAt: timestamp().notNull().defaultNow(),
    sourceGameId: uuid().references(() => game.id),
    meta: jsonb().$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("player_achievement_player_id_tier_unique").on(
      table.playerId,
      table.achievementId,
      table.tier,
    ),
  ],
);

/*
 * Turkish province mode. These tables mirror the country tables above so the two
 * modes never share game rows, stats, awards, or achievements. Province codes are
 * the two-digit plate codes (`01`–`81`), which match ISO 3166-2:TR.
 */

export const provinceGame = snakeCase.table(
  "province_game",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    guildId: uuid().references(() => guild.id),
    channelId: uuid().references(() => channel.id),
    gameMasterPlayerId: uuid()
      .notNull()
      .references(() => player.id),
    locationId: uuid()
      .notNull()
      .references(() => location.id),
    targetProvinceCode: varchar({ length: 2 }).notNull(),
    status: varchar({ length: 32 }).notNull().default("active"),
    screenshotUrl: text().notNull(),
    screenshotMessageId: text(),
    announcementMessageId: text(),
    startedAt: timestamp().notNull().defaultNow(),
    endedAt: timestamp(),
    winnerPlayerId: uuid().references(() => player.id),
    winningGuessId: uuid(),
    wrongGuessCount: integer().notNull().default(0),
    uniqueWrongProvinceCount: integer().notNull().default(0),
    totalGuessCount: integer().notNull().default(0),
    repeatGuessCount: integer().notNull().default(0),
    basePoints: integer().notNull().default(100),
    currentMultiplierFinal: numeric({ precision: 6, scale: 2 }).notNull().default("1.00"),
    gmMultiplierAtStart: numeric({ precision: 6, scale: 2 }).notNull().default("1.00"),
    pointsAwarded: integer().notNull().default(0),
    isTest: boolean().notNull().default(false),
    /** `dm`, `channel`, or `hybrid`. */
    startSource: varchar({ length: 16 }),
    announcedAt: timestamp(),
    cancelReason: text(),
    cancelledByPlayerId: uuid().references(() => player.id),
    ...timestamps,
  },
  (table) => [
    check(
      "province_game_start_source_known",
      sql`${table.startSource} IS NULL OR ${table.startSource} IN ('dm', 'channel', 'hybrid')`,
    ),
  ],
);

export const provinceGuess = snakeCase.table("province_guess", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  gameId: uuid()
    .notNull()
    .references(() => provinceGame.id),
  playerId: uuid()
    .notNull()
    .references(() => player.id),
  discordMessageId: text().notNull(),
  rawMessage: text().notNull(),
  parsedProvinceCode: varchar({ length: 2 }),
  parsedProvinceName: text(),
  parserStrategy: text(),
  isCorrect: boolean().notNull().default(false),
  isRepeat: boolean().notNull().default(false),
  isRateLimited: boolean().notNull().default(false),
  reaction: text(),
  /** Discord message time, decoded from the snowflake. */
  sentAt: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const provincePlayerGame = snakeCase.table(
  "province_player_game",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    playerId: uuid()
      .notNull()
      .references(() => player.id),
    gameId: uuid()
      .notNull()
      .references(() => provinceGame.id),
    role: varchar({ length: 32 }).notNull().default("player"),
    guessCount: integer().notNull().default(0),
    uniqueWrongGuessCount: integer().notNull().default(0),
    repeatGuessCount: integer().notNull().default(0),
    firstGuessAt: timestamp(),
    lastGuessAt: timestamp(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("province_player_game_unique").on(table.playerId, table.gameId, table.role),
  ],
);

export const provincePlayerStat = snakeCase.table("province_player_stat", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  playerId: uuid()
    .notNull()
    .references(() => player.id)
    .unique(),
  gamesStarted: integer().notNull().default(0),
  gamesParticipated: integer().notNull().default(0),
  gamesWon: integer().notNull().default(0),
  totalGuesses: integer().notNull().default(0),
  correctGuesses: integer().notNull().default(0),
  wrongGuesses: integer().notNull().default(0),
  repeatGuesses: integer().notNull().default(0),
  pointsTotal: integer().notNull().default(0),
  bestSingleGamePoints: integer().notNull().default(0),
  currentGmMultiplier: numeric({ precision: 6, scale: 2 }).notNull().default("1.00"),
  maxGameWrongGuessCountAsGm: integer().notNull().default(0),
  ...timestamps,
});

export const provinceStat = snakeCase.table("province_stat", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  provinceCode: varchar({ length: 2 }).notNull().unique(),
  timesUsedAsTarget: integer().notNull().default(0),
  timesGuessed: integer().notNull().default(0),
  timesGuessedWrong: integer().notNull().default(0),
  timesGuessedCorrect: integer().notNull().default(0),
  ...timestamps,
});

export const provinceGameMasterMilestone = snakeCase.table(
  "province_game_master_milestone",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    playerId: uuid()
      .notNull()
      .references(() => player.id),
    milestoneGuessCount: integer().notNull(),
    gameId: uuid()
      .notNull()
      .references(() => provinceGame.id),
    earnedMultiplierIncrement: numeric({ precision: 6, scale: 2 }).notNull().default("0.10"),
    earnedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("province_game_master_milestone_unique").on(
      table.playerId,
      table.milestoneGuessCount,
    ),
  ],
);

export const provincePointLedger = snakeCase.table("province_point_ledger", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  playerId: uuid()
    .notNull()
    .references(() => player.id),
  gameId: uuid()
    .notNull()
    .references(() => provinceGame.id),
  reason: text().notNull(),
  basePoints: integer().notNull(),
  currentMultiplier: numeric({ precision: 6, scale: 2 }).notNull(),
  gmMultiplier: numeric({ precision: 6, scale: 2 }).notNull(),
  pointsDelta: integer().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const provinceMultiplierEvent = snakeCase.table("province_multiplier_event", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  gameId: uuid()
    .notNull()
    .references(() => provinceGame.id),
  kind: varchar({ length: 32 }).notNull(),
  previousMultiplier: numeric({ precision: 6, scale: 2 }).notNull(),
  increment: numeric({ precision: 6, scale: 2 }).notNull(),
  newMultiplier: numeric({ precision: 6, scale: 2 }).notNull(),
  messageId: text(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const provinceAwardPeriod = snakeCase.table(
  "province_award_period",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    periodType: varchar({ length: 32 }).notNull(),
    periodKey: text().notNull(),
    startsAt: timestamp().notNull(),
    endsAt: timestamp().notNull(),
    announcedAt: timestamp(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("province_award_period_type_key_unique").on(table.periodType, table.periodKey),
  ],
);

export const provincePeriodAward = snakeCase.table(
  "province_period_award",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    awardPeriodId: uuid()
      .notNull()
      .references(() => provinceAwardPeriod.id),
    playerId: uuid()
      .notNull()
      .references(() => player.id),
    category: varchar({ length: 32 }).notNull(),
    medal: varchar({ length: 16 }).notNull(),
    rankValue: integer().notNull(),
    medalPoints: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("province_period_award_period_category_player_unique").on(
      table.awardPeriodId,
      table.category,
      table.playerId,
    ),
  ],
);

export const provincePlayerAchievement = snakeCase.table(
  "province_player_achievement",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    playerId: uuid()
      .notNull()
      .references(() => player.id),
    achievementId: text().notNull(),
    /** Ladder threshold, or `0` for oneshots. */
    tier: integer().notNull().default(0),
    earnedAt: timestamp().notNull().defaultNow(),
    sourceGameId: uuid().references(() => provinceGame.id),
    meta: jsonb().$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("province_player_achievement_player_id_tier_unique").on(
      table.playerId,
      table.achievementId,
      table.tier,
    ),
  ],
);

export const schema = {
  rule,
  guild,
  channel,
  player,
  feedback,
  location,
  game,
  guess,
  playerGame,
  playerStat,
  countryStat,
  gameMasterMilestone,
  pointLedger,
  multiplierEvent,
  commandLog,
  startAttempt,
  suspicionDismissal,
  awardPeriod,
  periodAward,
  playerAchievement,
  provinceGame,
  provinceGuess,
  provincePlayerGame,
  provincePlayerStat,
  provinceStat,
  provinceGameMasterMilestone,
  provincePointLedger,
  provinceMultiplierEvent,
  provinceAwardPeriod,
  provincePeriodAward,
  provincePlayerAchievement,
};
