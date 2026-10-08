import type { GuildBasedChannel, Message, User } from "discord.js";
import { AttachmentBuilder, MessageFlags } from "discord.js";
import { isTestChannel, loadRules } from "../../config/rules.ts";
import { sqlClient } from "../../db/client.ts";
import { reverseGeocode } from "../geocoding/nominatim-client.ts";
import type { ParsedGoogleMapsUrl } from "../geocoding/google-maps-parser.ts";
import { isUntrustedReverseGeocodeCountry } from "../geocoding/untrusted-country.ts";
import { calculateReward, earnedMilestonesForGuessCount } from "./scoring.ts";
import {
  addWrongCountry,
  clearActiveGame,
  gameModeOf,
  getCachedMap,
  getWrongCountries,
  hasWrongCountry,
  mapHash,
  releaseGameWinClaim,
  setCachedMap,
  setActiveGame,
  targetCodeOf,
  tryClaimGameWin,
  updateGameState,
  type ActiveGameState,
} from "./active-game-state.ts";
import { tablesFor, type GameMode } from "./game-mode.ts";
import { parseGuessForMode, targetDisplayName } from "./guess-parser.ts";
import { resolveProvince } from "../provinces/resolve-province.ts";
import { getProvinceName } from "../provinces/normalize-province-guess.ts";
import { describeProvinceLocation } from "../provinces/municipality.ts";
import { renderProvinceMap, TURKEY_MAP_VIEWPORT } from "../maps/province-map-renderer.ts";
import {
  ensurePlayerStat,
  upsertChannel,
  upsertGuild,
  upsertPlayer,
} from "../../repositories/core-repository.ts";
import { getGameParticipantIds } from "../achievements/metrics.ts";
import { onGameCompleted } from "../achievements/hooks.ts";
import { getCountryDisplayName, isKnownCountryCode } from "../countries/normalize-country-guess.ts";
import { isRateLimited, nextStreaks, type GuessStreakState } from "./rate-limit.ts";
import { pickWrongGuessReaction } from "./wrong-guess-reaction.ts";
import { redis } from "../../redis/client.ts";
import { keys } from "../../redis/keys.ts";
import { renderMap } from "../maps/map-renderer.ts";
import { removeMultiplierJobsForGame, scheduleGuessLimitReset } from "../../jobs/queues.ts";
import { canBypassGameMasterBlock } from "./test-mode.ts";
import { messages } from "../../i18n/messages.ts";
import { logger } from "../../util/logger.ts";
import type { StartSource } from "../review/start-source.ts";

export type StartGameInput = {
  guildChannel: GuildBasedChannel;
  gameMaster: User;
  location: ParsedGoogleMapsUrl;
  screenshotUrl: string;
  startSource?: StartSource;
  mode?: GameMode;
};

/** Province games need a location inside Türkiye. */
export class LocationOutsideTurkeyError extends Error {
  constructor(public readonly countryCode: string) {
    super(`Province games need a location in Türkiye, got ${countryCode}`);
    this.name = "LocationOutsideTurkeyError";
  }
}

export class UnknownProvinceError extends Error {
  constructor() {
    super("Could not resolve the province for this location");
    this.name = "UnknownProvinceError";
  }
}

export class UntrustedReverseGeocodeCountryError extends Error {
  constructor(public readonly countryCode: string) {
    super(`Reverse geocoding is not trusted for country ${countryCode}`);
    this.name = "UntrustedReverseGeocodeCountryError";
  }
}

const decimal = (value: unknown) => Number(value ?? 1);

/** jsonb can come back as text when it was written as a JSON string. */
const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const getCurrentGmMultiplier = async (playerId: string, max: number, mode: GameMode) => {
  const rows = await sqlClient`
    SELECT current_gm_multiplier
    FROM ${sqlClient(tablesFor(mode).playerStat)}
    WHERE player_id = ${playerId}
  `;
  return Math.min(max, decimal(rows[0]?.current_gm_multiplier ?? 1));
};

export const startGame = async ({
  guildChannel,
  gameMaster,
  location,
  screenshotUrl,
  startSource,
  mode = "country",
}: StartGameInput) => {
  if (!guildChannel.guild) {
    throw new Error("Games can only start in guild channels");
  }

  const t = tablesFor(mode);
  const geocode = await reverseGeocode(
    location.latitude,
    location.longitude,
    mode === "province" ? "tr" : "en",
  );
  let provinceCode: string | undefined;
  if (mode === "province") {
    if (geocode.countryCode !== "TR") {
      throw new LocationOutsideTurkeyError(geocode.countryCode);
    }
    provinceCode = resolveProvince(
      geocode.raw,
      location.latitude,
      location.longitude,
    )?.provinceCode;
    if (!provinceCode) {
      throw new UnknownProvinceError();
    }
  } else {
    if (isUntrustedReverseGeocodeCountry(geocode.countryCode)) {
      throw new UntrustedReverseGeocodeCountryError(geocode.countryCode);
    }
    if (!isKnownCountryCode(geocode.countryCode)) {
      throw new Error(
        `Unsupported country code from Nominatim: ${geocode.countryCode}. Add it to the country catalog before starting a game there.`,
      );
    }
  }

  const rules = await loadRules();
  const guildId = await upsertGuild(guildChannel.guild);
  const channelId = await upsertChannel(guildChannel, guildId);
  // Starts can come from DMs, so look up the server nickname in the game's guild.
  const member = await guildChannel.guild.members.fetch(gameMaster.id).catch(() => null);
  const player = await upsertPlayer(gameMaster, member?.displayName);
  await ensurePlayerStat(player.id, mode);
  const isTestGame = isTestChannel(guildChannel.id, rules);

  const gmMultiplier = await getCurrentGmMultiplier(player.id, rules.gmMultiplierMax, mode);

  const rows = await sqlClient.begin(async (tx) => {
    const locationRows = await tx`
      INSERT INTO location (
        original_google_maps_url,
        resolved_google_maps_url,
        latitude,
        longitude,
        coordinate_source,
        country_code,
        country_name,
        region_name,
        region_code,
        nominatim_place_id,
        nominatim_osm_type,
        nominatim_osm_id,
        nominatim_raw_json
      )
      VALUES (
        ${location.originalUrl},
        ${location.resolvedUrl},
        ${location.latitude},
        ${location.longitude},
        ${location.source},
        ${geocode.countryCode},
        ${geocode.countryName ?? null},
        ${geocode.regionName ?? null},
        ${provinceCode ? `TR-${provinceCode}` : (geocode.regionCode ?? null)},
        ${geocode.placeId ?? null},
        ${geocode.osmType ?? null},
        ${geocode.osmId ?? null},
        ${JSON.stringify(geocode.raw)}
      )
      RETURNING id
    `;

    const gameRows =
      mode === "province"
        ? await tx`
      INSERT INTO province_game (
        guild_id,
        channel_id,
        game_master_player_id,
        location_id,
        status,
        screenshot_url,
        base_points,
        gm_multiplier_at_start,
        current_multiplier_final,
        is_test,
        start_source,
        target_province_code
      )
      VALUES (
        ${guildId ?? null},
        ${channelId ?? null},
        ${player.id},
        ${locationRows[0]?.id},
        'active',
        ${screenshotUrl},
        ${rules.baseWinPoints},
        ${gmMultiplier},
        1.00,
        ${isTestGame},
        ${startSource ?? null},
        ${provinceCode ?? null}
      )
      RETURNING id
    `
        : await tx`
      INSERT INTO game (
        guild_id,
        channel_id,
        game_master_player_id,
        location_id,
        status,
        screenshot_url,
        base_points,
        gm_multiplier_at_start,
        current_multiplier_final,
        is_test,
        start_source
      )
      VALUES (
        ${guildId ?? null},
        ${channelId ?? null},
        ${player.id},
        ${locationRows[0]?.id},
        'active',
        ${screenshotUrl},
        ${rules.baseWinPoints},
        ${gmMultiplier},
        1.00,
        ${isTestGame},
        ${startSource ?? null}
      )
      RETURNING id
    `;

    if (!isTestGame) {
      await tx`
        INSERT INTO ${tx(t.playerStat)} AS ps (player_id, games_started, current_gm_multiplier)
        VALUES (${player.id}, 1, ${gmMultiplier})
        ON CONFLICT (player_id)
        DO UPDATE SET games_started = ps.games_started + 1, updated_at = now()
      `;

      await tx`
        INSERT INTO ${tx(t.targetStat)} AS ts (${tx(t.targetStatCodeColumn)}, times_used_as_target)
        VALUES (${provinceCode ?? geocode.countryCode}, 1)
        ON CONFLICT (${tx(t.targetStatCodeColumn)})
        DO UPDATE SET times_used_as_target = ts.times_used_as_target + 1, updated_at = now()
      `;
    }

    return gameRows;
  });

  const gameId = rows[0]?.id as string | undefined;
  if (!gameId) {
    throw new Error("Failed to create game");
  }

  const state: ActiveGameState = {
    mode,
    gameId,
    guildId: guildChannel.guild.id,
    channelId: guildChannel.id,
    gameMasterDiscordUserId: gameMaster.id,
    gameMasterPlayerId: player.id,
    targetCountryCode: geocode.countryCode,
    targetRegionName: geocode.regionName,
    targetProvinceCode: provinceCode,
    screenshotUrl,
    currentMultiplier: 1,
    gmMultiplier,
    basePoints: rules.baseWinPoints,
    lastGuessAt: Date.now(),
    startedAt: Date.now(),
    isTest: isTestGame,
  };

  const claimed = await setActiveGame(state);
  if (!claimed) {
    await sqlClient`
      UPDATE ${sqlClient(t.game)}
      SET
        status = 'cancelled',
        cancel_reason = 'lost_active_slot_race',
        ended_at = now(),
        updated_at = now()
      WHERE id = ${gameId}
    `;
    throw new Error("Another game became active in this channel");
  }

  return {
    state,
    countryName: geocode.countryName ?? getCountryDisplayName(geocode.countryCode, messages.locale),
    regionName: geocode.regionName,
    provinceName: provinceCode ? getProvinceName(provinceCode) : undefined,
  };
};

export const handleGuess = async (message: Message<true>, state: ActiveGameState) => {
  const mode = gameModeOf(state);
  const parsed = parseGuessForMode(mode, message.content);
  if (!parsed) {
    return "ignored" as const;
  }

  const rules = await loadRules();
  const player = await upsertPlayer(message.author, message.member?.displayName);
  await ensurePlayerStat(player.id, mode);

  const canBypassGmBlock = canBypassGameMasterBlock(
    state,
    message.channel.id,
    message.author.id,
    rules,
  );

  if (message.author.id === state.gameMasterDiscordUserId && !canBypassGmBlock) {
    return "game-master-blocked" as const;
  }

  const isCorrect = parsed.code === targetCodeOf(state);
  const isRepeat = !isCorrect && (await hasWrongCountry(state.gameId, parsed.code));
  const now = Date.now();

  // Repeat guesses do not consume the consecutive-guess limit.
  if (!isRepeat) {
    const streakRaw = await redis.get(keys.guessStreaks(state.gameId));
    const streaks = streakRaw ? (JSON.parse(streakRaw) as Record<string, GuessStreakState>) : {};

    if (
      isRateLimited(
        streaks[message.author.id],
        now,
        rules.maxConsecutiveGuesses,
        rules.consecutiveGuessIdleResetSeconds,
      )
    ) {
      await persistGuess(
        message,
        state,
        player.id,
        parsed.code,
        parsed.displayName,
        parsed.strategy,
        false,
        false,
        true,
        "⏳",
      );
      return "rate-limited" as const;
    }

    const updatedStreaks = nextStreaks(
      streaks,
      message.author.id,
      now,
      rules.consecutiveGuessIdleResetSeconds,
    );
    await redis.set(keys.guessStreaks(state.gameId), JSON.stringify(updatedStreaks));

    // This guess capped the streak; announce in-channel when it expires on its own.
    if (updatedStreaks[message.author.id]!.count === rules.maxConsecutiveGuesses) {
      await scheduleGuessLimitReset(
        state.gameId,
        message.author.id,
        now,
        rules.consecutiveGuessIdleResetSeconds * 1000,
      ).catch((error: Error) => {
        logger.error("Failed to schedule guess limit reset", {
          gameId: state.gameId,
          error: error.message,
        });
      });
    }
  }

  // Only the first concurrent correct guess may complete the game.
  if (isCorrect) {
    const claimed = await tryClaimGameWin(state.gameId, message.id);
    if (!claimed) {
      return "ignored" as const;
    }
  }

  try {
    const reaction = isCorrect ? "✅" : isRepeat ? "🔄" : pickWrongGuessReaction();
    const guessId = await persistGuess(
      message,
      state,
      player.id,
      parsed.code,
      parsed.displayName,
      parsed.strategy,
      isCorrect,
      isRepeat,
      false,
      reaction,
    );

    if (!isCorrect && !isRepeat) {
      await addWrongCountry(state.gameId, parsed.code);
    }

    state.lastGuessAt = now;
    await updateGameState(state);

    if (isCorrect) {
      return await completeGame(message, state, player.id, guessId);
    }

    return reaction;
  } catch (error) {
    if (isCorrect) {
      await releaseGameWinClaim(state.gameId);
    }
    throw error;
  }
};

const persistGuess = async (
  message: Message<true>,
  state: ActiveGameState,
  playerId: string,
  countryCode: string,
  countryName: string,
  parserStrategy: string,
  isCorrect: boolean,
  isRepeat: boolean,
  isRateLimitedValue: boolean,
  reaction: string,
) => {
  const t = tablesFor(gameModeOf(state));
  const rows = await sqlClient.begin(async (tx) => {
    const guessRows = await tx`
      INSERT INTO ${tx(t.guess)} (
        game_id,
        player_id,
        discord_message_id,
        raw_message,
        ${tx(t.parsedCodeColumn)},
        ${tx(t.parsedNameColumn)},
        parser_strategy,
        is_correct,
        is_repeat,
        is_rate_limited,
        reaction,
        sent_at
      )
      VALUES (
        ${state.gameId},
        ${playerId},
        ${message.id},
        ${message.content},
        ${countryCode},
        ${countryName},
        ${parserStrategy},
        ${isCorrect},
        ${isRepeat},
        ${isRateLimitedValue},
        ${reaction},
        ${message.createdAt}
      )
      RETURNING id
    `;

    if (!isRateLimitedValue && !state.isTest) {
      await tx`
        UPDATE ${tx(t.game)}
        SET
          total_guess_count = total_guess_count + 1,
          wrong_guess_count = wrong_guess_count + ${isCorrect || isRepeat ? 0 : 1},
          ${tx(t.uniqueWrongColumn)} = ${tx(t.uniqueWrongColumn)} + ${isCorrect || isRepeat ? 0 : 1},
          repeat_guess_count = repeat_guess_count + ${isRepeat ? 1 : 0},
          updated_at = now()
        WHERE id = ${state.gameId}
      `;

      await tx`
        INSERT INTO ${tx(t.playerGame)} AS pg (player_id, game_id, role, guess_count, unique_wrong_guess_count, repeat_guess_count, first_guess_at, last_guess_at)
        VALUES (${playerId}, ${state.gameId}, 'player', 1, ${isCorrect || isRepeat ? 0 : 1}, ${isRepeat ? 1 : 0}, now(), now())
        ON CONFLICT (player_id, game_id, role)
        DO UPDATE SET
          guess_count = pg.guess_count + 1,
          unique_wrong_guess_count = pg.unique_wrong_guess_count + ${isCorrect || isRepeat ? 0 : 1},
          repeat_guess_count = pg.repeat_guess_count + ${isRepeat ? 1 : 0},
          last_guess_at = now(),
          updated_at = now()
      `;

      await tx`
        UPDATE ${tx(t.playerStat)}
        SET
          games_participated = games_participated + CASE WHEN NOT EXISTS (
            SELECT 1 FROM ${tx(t.playerGame)} pg WHERE pg.player_id = ${playerId} AND pg.game_id = ${state.gameId} AND pg.role = 'player' AND pg.guess_count > 1
          ) THEN 1 ELSE 0 END,
          total_guesses = total_guesses + 1,
          correct_guesses = correct_guesses + ${isCorrect ? 1 : 0},
          wrong_guesses = wrong_guesses + ${isCorrect || isRepeat ? 0 : 1},
          repeat_guesses = repeat_guesses + ${isRepeat ? 1 : 0},
          updated_at = now()
        WHERE player_id = ${playerId}
      `;

      await tx`
        INSERT INTO ${tx(t.targetStat)} AS ts (${tx(t.targetStatCodeColumn)}, times_guessed, times_guessed_wrong, times_guessed_correct)
        VALUES (${countryCode}, 1, ${isCorrect ? 0 : 1}, ${isCorrect ? 1 : 0})
        ON CONFLICT (${tx(t.targetStatCodeColumn)})
        DO UPDATE SET
          times_guessed = ts.times_guessed + 1,
          times_guessed_wrong = ts.times_guessed_wrong + ${isCorrect ? 0 : 1},
          times_guessed_correct = ts.times_guessed_correct + ${isCorrect ? 1 : 0},
          updated_at = now()
      `;
    }

    if (!isRateLimitedValue && state.isTest) {
      await tx`
        UPDATE ${tx(t.game)}
        SET
          total_guess_count = total_guess_count + 1,
          wrong_guess_count = wrong_guess_count + ${isCorrect || isRepeat ? 0 : 1},
          ${tx(t.uniqueWrongColumn)} = ${tx(t.uniqueWrongColumn)} + ${isCorrect || isRepeat ? 0 : 1},
          repeat_guess_count = repeat_guess_count + ${isRepeat ? 1 : 0},
          updated_at = now()
        WHERE id = ${state.gameId}
      `;
    }

    return guessRows;
  });

  return rows[0]?.id as string;
};

const completeGame = async (
  message: Message<true>,
  state: ActiveGameState,
  winnerPlayerId: string,
  guessId: string,
) => {
  const t = tablesFor(gameModeOf(state));
  const wrongCountries = await getWrongCountries(state.gameId);
  const points = state.isTest
    ? 0
    : calculateReward(state.basePoints, state.currentMultiplier, state.gmMultiplier);

  const completed = await sqlClient.begin(async (tx) => {
    const updated = await tx`
      UPDATE ${tx(t.game)}
      SET
        status = 'completed',
        ended_at = now(),
        winner_player_id = ${winnerPlayerId},
        winning_guess_id = ${guessId},
        current_multiplier_final = ${state.currentMultiplier},
        points_awarded = ${points},
        updated_at = now()
      WHERE id = ${state.gameId}
        AND status = 'active'
      RETURNING id
    `;

    if (!updated[0]) {
      return false;
    }

    if (!state.isTest) {
      await tx`
        INSERT INTO ${tx(t.pointLedger)} (player_id, game_id, reason, base_points, current_multiplier, gm_multiplier, points_delta)
        VALUES (${winnerPlayerId}, ${state.gameId}, 'game_win', ${state.basePoints}, ${state.currentMultiplier}, ${state.gmMultiplier}, ${points})
      `;

      await tx`
        UPDATE ${tx(t.playerStat)}
        SET
          games_won = games_won + 1,
          points_total = points_total + ${points},
          best_single_game_points = GREATEST(best_single_game_points, ${points}),
          updated_at = now()
        WHERE player_id = ${winnerPlayerId}
      `;

      await tx`
        INSERT INTO ${tx(t.playerGame)} (player_id, game_id, role, guess_count)
        VALUES (${winnerPlayerId}, ${state.gameId}, 'winner', 0)
        ON CONFLICT (player_id, game_id, role) DO NOTHING
      `;

      for (const milestone of earnedMilestonesForGuessCount(wrongCountries.length)) {
        await tx`
          INSERT INTO ${tx(t.milestone)} (player_id, milestone_guess_count, game_id)
          VALUES (${state.gameMasterPlayerId}, ${milestone}, ${state.gameId})
          ON CONFLICT (player_id, milestone_guess_count) DO NOTHING
        `;
      }

      const milestoneRows = await tx`
        SELECT COUNT(*)::integer AS count
        FROM ${tx(t.milestone)}
        WHERE player_id = ${state.gameMasterPlayerId}
      `;
      const gmMultiplier = Math.min(3, 1 + Number(milestoneRows[0]?.count ?? 0) * 0.1);
      await tx`
        UPDATE ${tx(t.playerStat)}
        SET
          current_gm_multiplier = ${gmMultiplier},
          max_game_wrong_guess_count_as_gm = GREATEST(max_game_wrong_guess_count_as_gm, ${wrongCountries.length}),
          updated_at = now()
        WHERE player_id = ${state.gameMasterPlayerId}
      `;
    }

    return true;
  });

  if (!completed) {
    await releaseGameWinClaim(state.gameId);
    return "ignored" as const;
  }

  // Drop the active slot immediately so later messages cannot start another win path
  // while we still render the end-of-game map/announcement.
  await clearActiveGame(state);
  await removeMultiplierJobsForGame(state.gameId);

  // Confirm the win on the guess message before any map/announce work.
  await message.react("✅").catch(() => undefined);

  void announceGameWin(message, state, winnerPlayerId, points, wrongCountries).catch((error) => {
    logger.error("Failed to post end-of-game announcement", {
      gameId: state.gameId,
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return "already-reacted" as const;
};

const announceGameWin = async (
  message: Message<true>,
  state: ActiveGameState,
  winnerPlayerId: string,
  points: number,
  wrongCountries: string[],
) => {
  const mode = gameModeOf(state);
  const locationRows = await sqlClient`
    SELECT
      l.original_google_maps_url,
      l.resolved_google_maps_url,
      l.region_name,
      l.latitude,
      l.longitude,
      l.nominatim_raw_json
    FROM ${sqlClient(tablesFor(mode).game)} g
    JOIN location l ON l.id = g.location_id
    WHERE g.id = ${state.gameId}
    LIMIT 1
  `;
  const location = locationRows[0] as
    | {
        original_google_maps_url: string;
        resolved_google_maps_url: string | null;
        region_name: string | null;
        latitude: number;
        longitude: number;
        nominatim_raw_json: unknown;
      }
    | undefined;
  const latitude = location ? Number(location.latitude) : undefined;
  const longitude = location ? Number(location.longitude) : undefined;
  const googleMapsUrl =
    location?.original_google_maps_url ??
    location?.resolved_google_maps_url ??
    (latitude != null && longitude != null
      ? `https://www.google.com/maps/@${latitude},${longitude},3a,75y,0h,90t`
      : undefined);

  const marker = latitude != null && longitude != null ? { latitude, longitude } : undefined;
  const targetCode = targetCodeOf(state);
  const viewport = mode === "province" ? TURKEY_MAP_VIEWPORT : "world";
  const hash = mapHash(wrongCountries, targetCode, marker);
  const cached = await getCachedMap(state.gameId, viewport, hash);
  const map = cached
    ? {
        buffer: cached,
        filename:
          mode === "province" ? messages.filenames.turkeyGuesses : messages.filenames.worldGuesses,
      }
    : mode === "province"
      ? renderProvinceMap({ wrongProvinces: wrongCountries, correctProvince: targetCode, marker })
      : renderMap({
          wrongCountries,
          correctCountry: state.targetCountryCode,
          viewport: "world",
          marker,
        });
  const attachment = new AttachmentBuilder(map.buffer, { name: map.filename });
  const send = message.channel.send({
    content: [
      mode === "province"
        ? messages.province.foundProvince(
            message.author.id,
            targetDisplayName(mode, targetCode, messages.locale),
          )
        : messages.game.foundCountry(
            message.author.id,
            getCountryDisplayName(state.targetCountryCode, messages.locale),
          ),
      googleMapsUrl && latitude != null && longitude != null && mode === "province"
        ? messages.province.locationDetails({
            ...describeProvinceLocation(parseJson(location?.nominatim_raw_json), targetCode),
            googleMapsUrl,
            latitude,
            longitude,
          })
        : googleMapsUrl && latitude != null && longitude != null
          ? messages.game.locationDetails({
              regionName: location?.region_name ?? state.targetRegionName ?? undefined,
              googleMapsUrl,
              latitude,
              longitude,
            })
          : undefined,
      messages.game.wrongGuessCount(wrongCountries.length),
      state.isTest
        ? messages.game.testNoPoints
        : messages.game.reward(
            points,
            state.basePoints,
            state.currentMultiplier,
            state.gmMultiplier,
          ),
      messages.game.osmAttribution,
    ]
      .filter(Boolean)
      .join("\n"),
    files: [attachment],
    flags: MessageFlags.SuppressEmbeds,
  });
  await Promise.all([
    send,
    cached ? undefined : setCachedMap(state.gameId, viewport, hash, map.buffer),
  ]);

  if (!state.isTest) {
    const rules = await loadRules();
    const participantPlayerIds = await getGameParticipantIds(state.gameId, mode);
    await onGameCompleted(message.client, {
      mode,
      gameId: state.gameId,
      winnerPlayerId,
      gameMasterPlayerId: state.gameMasterPlayerId,
      participantPlayerIds,
      uniqueWrongCountryCount: wrongCountries.length,
      currentMultiplier: state.currentMultiplier,
      currentMultiplierMax: rules.currentMultiplierMax,
      targetCountryCode: state.targetCountryCode,
      at: new Date(),
    });
  }
};
