import { redis } from "../../redis/client.ts";
import { keys } from "../../redis/keys.ts";

export type ActiveGameState = {
  gameId: string;
  guildId: string;
  channelId: string;
  gameMasterDiscordUserId: string;
  gameMasterPlayerId: string;
  targetCountryCode: string;
  targetRegionName?: string;
  screenshotUrl: string;
  /** Discord message id of the game-start announcement that holds the screenshot. */
  screenshotMessageId?: string;
  currentMultiplier: number;
  gmMultiplier: number;
  basePoints: number;
  lastGuessAt: number;
  startedAt: number;
  isTest: boolean;
};

export const getActiveGameId = async (guildId: string, channelId: string) =>
  redis.get(keys.activeGame(guildId, channelId));

export const setActiveGame = async (state: ActiveGameState): Promise<boolean> => {
  const claimed = await redis.set(
    keys.activeGame(state.guildId, state.channelId),
    state.gameId,
    "NX",
  );
  if (claimed !== "OK") {
    return false;
  }

  await redis.set(keys.gameState(state.gameId), JSON.stringify(state));
  return true;
};

export const getActiveGameState = async (guildId: string, channelId: string) => {
  const gameId = await getActiveGameId(guildId, channelId);
  if (!gameId) {
    return undefined;
  }

  const raw = await redis.get(keys.gameState(gameId));
  return raw ? ({ isTest: false, ...JSON.parse(raw) } as ActiveGameState) : undefined;
};

export const getGameStateById = async (gameId: string) => {
  const raw = await redis.get(keys.gameState(gameId));
  return raw ? ({ isTest: false, ...JSON.parse(raw) } as ActiveGameState) : undefined;
};

export const updateGameState = async (state: ActiveGameState) => {
  await redis.set(keys.gameState(state.gameId), JSON.stringify(state));
};

/** Safety TTL if a claim is left behind after a crash mid-completion. */
const WIN_CLAIM_TTL_SECONDS = 300;

export const tryClaimGameWin = async (gameId: string, messageId: string): Promise<boolean> => {
  const result = await redis.set(
    keys.winClaim(gameId),
    messageId,
    "EX",
    String(WIN_CLAIM_TTL_SECONDS),
    "NX",
  );
  return result === "OK";
};

export const releaseGameWinClaim = async (gameId: string) => {
  await redis.del(keys.winClaim(gameId));
};

export const clearGameKeys = async (guildId: string, channelId: string, gameId: string) => {
  const cacheKeys = await redis.keys(`game:${gameId}:map-cache:*`);
  await redis.del(
    keys.activeGame(guildId, channelId),
    keys.gameState(gameId),
    keys.wrongCountries(gameId),
    keys.guessStreaks(gameId),
    keys.winClaim(gameId),
    ...cacheKeys,
  );
};

export const clearActiveGame = async (state: ActiveGameState) => {
  await clearGameKeys(state.guildId, state.channelId, state.gameId);
};

export const clearGuessStreaks = async (gameId: string) => redis.del(keys.guessStreaks(gameId));

export const getWrongCountries = async (gameId: string) =>
  (await redis.smembers(keys.wrongCountries(gameId))).sort();

export const addWrongCountry = async (gameId: string, countryCode: string) =>
  redis.sadd(keys.wrongCountries(gameId), countryCode);

export const hasWrongCountry = async (gameId: string, countryCode: string) =>
  redis.sismember(keys.wrongCountries(gameId), countryCode);

export const getCachedMap = async (
  gameId: string,
  viewport: string,
  hash: string,
): Promise<Buffer | undefined> => {
  const raw = await redis.getBuffer(keys.mapCache(gameId, viewport, hash));
  return raw ? Buffer.from(raw) : undefined;
};

export const setCachedMap = async (
  gameId: string,
  viewport: string,
  hash: string,
  buffer: Buffer,
) => {
  await redis.set(keys.mapCache(gameId, viewport, hash), buffer, "EX", 3600);
};

export const mapHash = (
  wrongCountries: string[],
  correctCountry?: string,
  marker?: { latitude: number; longitude: number },
) => {
  const markerKey =
    marker == null ? "" : `|${marker.latitude.toFixed(5)},${marker.longitude.toFixed(5)}`;
  return [...wrongCountries].sort().join(",") + `|${correctCountry ?? ""}${markerKey}`;
};
