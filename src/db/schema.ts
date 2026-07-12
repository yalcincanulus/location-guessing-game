import { sql } from "drizzle-orm";
import {
  boolean,
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
  testModeEnabled: boolean().notNull().default(false),
  testChannelId: text(),
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
  firstSeenAt: timestamp().notNull().defaultNow(),
  lastSeenAt: timestamp().notNull().defaultNow(),
  ...timestamps,
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

export const game = snakeCase.table("game", {
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
  cancelReason: text(),
  cancelledByPlayerId: uuid().references(() => player.id),
  ...timestamps,
});

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

export const schema = {
  rule,
  guild,
  channel,
  player,
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
  awardPeriod,
  periodAward,
  playerAchievement,
};
