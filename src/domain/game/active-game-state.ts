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
  currentMultiplier: number;
  gmMultiplier: number;
  basePoints: number;
  lastGuessAt: number;
  startedAt: number;
  isTest: boolean;
};

export const getActiveGameId = async (guildId: string, channelId: string) =>
  redis.get(keys.activeGame(guildId, channelId));

export const setActiveGame = async (state: ActiveGameState) => {
  await redis
    .multi()
    .set(keys.activeGame(state.guildId, state.channelId), state.gameId)
    .set(keys.gameState(state.gameId), JSON.stringify(state))
    .exec();
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

export const clearGameKeys = async (guildId: string, channelId: string, gameId: string) => {
  const cacheKeys = await redis.keys(`game:${gameId}:map-cache:*`);
  const multi = redis
    .multi()
    .del(keys.activeGame(guildId, channelId))
    .del(keys.gameState(gameId))
    .del(keys.wrongCountries(gameId))
    .del(keys.guessStreaks(gameId));
  if (cacheKeys.length > 0) {
    multi.del(...cacheKeys);
  }
  await multi.exec();
};

export const clearActiveGame = async (state: ActiveGameState) => {
  await clearGameKeys(state.guildId, state.channelId, state.gameId);
};

export const getWrongCountries = async (gameId: string) =>
  (await redis.smembers(keys.wrongCountries(gameId))).sort();

export const addWrongCountry = async (gameId: string, countryCode: string) =>
  redis.sadd(keys.wrongCountries(gameId), countryCode);

export const hasWrongCountry = async (gameId: string, countryCode: string) =>
  (await redis.sismember(keys.wrongCountries(gameId), countryCode)) === 1;

export const getCachedMap = async (
  gameId: string,
  viewport: string,
  hash: string,
): Promise<Buffer | undefined> => {
  const raw = await redis.getBuffer(keys.mapCache(gameId, viewport, hash));
  return raw ?? undefined;
};

export const setCachedMap = async (
  gameId: string,
  viewport: string,
  hash: string,
  buffer: Buffer,
) => {
  await redis.set(keys.mapCache(gameId, viewport, hash), buffer, "EX", 3600);
};

export const mapHash = (wrongCountries: string[], correctCountry?: string) =>
  [...wrongCountries].sort().join(",") + `|${correctCountry ?? ""}`;
