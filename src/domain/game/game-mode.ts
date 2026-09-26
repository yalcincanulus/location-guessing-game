import type { GameRules } from "../../config/rules.ts";

/**
 * `country`: guess the country anywhere in the world (the original game).
 * `province`: guess one of Türkiye's 81 provinces, played in its own channel.
 */
export type GameMode = "country" | "province";

export const GAME_MODES: readonly GameMode[] = ["country", "province"];

/** Table and column names per mode. Each mode keeps its own games, stats, awards, and achievements. */
export type ModeTables = {
  game: string;
  guess: string;
  playerGame: string;
  playerStat: string;
  targetStat: string;
  milestone: string;
  pointLedger: string;
  multiplierEvent: string;
  awardPeriod: string;
  periodAward: string;
  playerAchievement: string;
  /** Unique wrong-guess counter on the game table. */
  uniqueWrongColumn: string;
  /** Parsed guess code / name on the guess table. */
  parsedCodeColumn: string;
  parsedNameColumn: string;
  /** Code column on the target stat table. */
  targetStatCodeColumn: string;
};

export const modeTables: Record<GameMode, ModeTables> = {
  country: {
    game: "game",
    guess: "guess",
    playerGame: "player_game",
    playerStat: "player_stat",
    targetStat: "country_stat",
    milestone: "game_master_milestone",
    pointLedger: "point_ledger",
    multiplierEvent: "multiplier_event",
    awardPeriod: "award_period",
    periodAward: "period_award",
    playerAchievement: "player_achievement",
    uniqueWrongColumn: "unique_wrong_country_count",
    parsedCodeColumn: "parsed_country_code",
    parsedNameColumn: "parsed_country_name",
    targetStatCodeColumn: "country_code",
  },
  province: {
    game: "province_game",
    guess: "province_guess",
    playerGame: "province_player_game",
    playerStat: "province_player_stat",
    targetStat: "province_stat",
    milestone: "province_game_master_milestone",
    pointLedger: "province_point_ledger",
    multiplierEvent: "province_multiplier_event",
    awardPeriod: "province_award_period",
    periodAward: "province_period_award",
    playerAchievement: "province_player_achievement",
    uniqueWrongColumn: "unique_wrong_province_count",
    parsedCodeColumn: "parsed_province_code",
    parsedNameColumn: "parsed_province_name",
    targetStatCodeColumn: "province_code",
  },
};

export const tablesFor = (mode: GameMode = "country") => modeTables[mode];

export const gameChannelIdFor = (rules: GameRules, mode: GameMode) =>
  mode === "province" ? rules.provinceGameChannelId : rules.gameChannelId;

export const gameStartsEnabledFor = (rules: GameRules, mode: GameMode) =>
  mode === "province" ? rules.provinceGameStartsEnabled : rules.gameStartsEnabled;

/**
 * The mode a channel plays, or undefined for other channels. With no country
 * channel configured, every channel except the province channels plays country games.
 */
export const modeForChannel = (rules: GameRules, channelId: string): GameMode | undefined => {
  if (rules.provinceGameChannelId && rules.provinceGameChannelId === channelId) {
    return "province";
  }
  // The province test channel plays province games only while test mode is on.
  if (
    rules.testModeEnabled &&
    rules.provinceTestChannelId &&
    rules.provinceTestChannelId === channelId
  ) {
    return "province";
  }
  if (!rules.gameChannelId || rules.gameChannelId === channelId) {
    return "country";
  }
  return undefined;
};

const MODE_TOKENS = new Map<string, GameMode>([
  ["il", "province"],
  ["iller", "province"],
  ["province", "province"],
  ["provinces", "province"],
  ["tr", "province"],
  ["turkiye", "province"],
  ["turkey", "province"],
  ["ulke", "country"],
  ["ulkeler", "country"],
  ["country", "country"],
  ["countries", "country"],
]);

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

export const parseModeToken = (value: string): GameMode | undefined =>
  MODE_TOKENS.get(normalizeToken(value));

/** Removes the first mode word (`il`, `province`, `ülke`, …) from command args. */
export const takeModeArg = (args: string[]): { mode?: GameMode; rest: string[] } => {
  const index = args.findIndex((arg) => parseModeToken(arg) !== undefined);
  if (index === -1) {
    return { rest: args };
  }
  return {
    mode: parseModeToken(args[index] ?? ""),
    rest: [...args.slice(0, index), ...args.slice(index + 1)],
  };
};
