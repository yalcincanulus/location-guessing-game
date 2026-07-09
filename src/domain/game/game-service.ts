import type { GuildBasedChannel, Message, User } from "discord.js";
import { AttachmentBuilder, MessageFlags } from "discord.js";
import { loadRules } from "../../config/rules.ts";
import { sqlClient } from "../../db/client.ts";
import { reverseGeocode } from "../geocoding/nominatim-client.ts";
import type { ParsedGoogleMapsUrl } from "../geocoding/google-maps-parser.ts";
import { calculateReward, earnedMilestonesForGuessCount } from "./scoring.ts";
import {
  addWrongCountry,
  clearActiveGame,
  getCachedMap,
  getWrongCountries,
  hasWrongCountry,
  mapHash,
  setCachedMap,
  setActiveGame,
  updateGameState,
  type ActiveGameState,
} from "./active-game-state.ts";
import {
  ensurePlayerStat,
  upsertChannel,
  upsertGuild,
  upsertPlayer,
} from "../../repositories/core-repository.ts";
import {
  normalizeCountryGuess,
  getCountryDisplayName,
  isKnownCountryCode,
} from "../countries/normalize-country-guess.ts";
import { isRateLimited, nextStreaks, type GuessStreakState } from "./rate-limit.ts";
import { redis } from "../../redis/client.ts";
import { keys } from "../../redis/keys.ts";
import { renderMap } from "../maps/map-renderer.ts";
import { removeMultiplierJobsForGame } from "../../jobs/queues.ts";
import { canBypassGameMasterBlock } from "./test-mode.ts";
import { messages } from "../../i18n/messages.ts";

export type StartGameInput = {
  guildChannel: GuildBasedChannel;
  gameMaster: User;
  location: ParsedGoogleMapsUrl;
  screenshotUrl: string;
};

const decimal = (value: unknown) => Number(value ?? 1);

const getCurrentGmMultiplier = async (playerId: string, max: number) => {
  const rows = await sqlClient`
    SELECT current_gm_multiplier
    FROM player_stat
    WHERE player_id = ${playerId}
  `;
  return Math.min(max, decimal(rows[0]?.current_gm_multiplier ?? 1));
};

export const startGame = async ({
  guildChannel,
  gameMaster,
  location,
  screenshotUrl,
}: StartGameInput) => {
  if (!guildChannel.guild) {
    throw new Error("Games can only start in guild channels");
  }

  const rules = await loadRules();
  const guildId = await upsertGuild(guildChannel.guild);
  const channelId = await upsertChannel(guildChannel, guildId);
  const player = await upsertPlayer(gameMaster);
  await ensurePlayerStat(player.id);
  const isTestGame = rules.testModeEnabled && rules.testChannelId === guildChannel.id;

  const geocode = await reverseGeocode(location.latitude, location.longitude);
  if (!isKnownCountryCode(geocode.countryCode)) {
    throw new Error(
      `Unsupported country code from Nominatim: ${geocode.countryCode}. Add it to the country catalog before starting a game there.`,
    );
  }
  const gmMultiplier = await getCurrentGmMultiplier(player.id, rules.gmMultiplierMax);

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
        ${geocode.regionCode ?? null},
        ${geocode.placeId ?? null},
        ${geocode.osmType ?? null},
        ${geocode.osmId ?? null},
        ${JSON.stringify(geocode.raw)}
      )
      RETURNING id
    `;

    const gameRows = await tx`
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
        is_test
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
        ${isTestGame}
      )
      RETURNING id
    `;

    if (!isTestGame) {
      await tx`
        INSERT INTO player_stat (player_id, games_started, current_gm_multiplier)
        VALUES (${player.id}, 1, ${gmMultiplier})
        ON CONFLICT (player_id)
        DO UPDATE SET games_started = player_stat.games_started + 1, updated_at = now()
      `;

      await tx`
        INSERT INTO country_stat (country_code, times_used_as_target)
        VALUES (${geocode.countryCode}, 1)
        ON CONFLICT (country_code)
        DO UPDATE SET times_used_as_target = country_stat.times_used_as_target + 1, updated_at = now()
      `;
    }

    return gameRows;
  });

  const gameId = rows[0]?.id as string | undefined;
  if (!gameId) {
    throw new Error("Failed to create game");
  }

  const state: ActiveGameState = {
    gameId,
    guildId: guildChannel.guild.id,
    channelId: guildChannel.id,
    gameMasterDiscordUserId: gameMaster.id,
    gameMasterPlayerId: player.id,
    targetCountryCode: geocode.countryCode,
    targetRegionName: geocode.regionName,
    screenshotUrl,
    currentMultiplier: 1,
    gmMultiplier,
    basePoints: rules.baseWinPoints,
    lastGuessAt: Date.now(),
    startedAt: Date.now(),
    isTest: isTestGame,
  };

  await setActiveGame(state);

  return {
    state,
    countryName: geocode.countryName ?? getCountryDisplayName(geocode.countryCode, messages.locale),
    regionName: geocode.regionName,
  };
};

export const handleGuess = async (message: Message<true>, state: ActiveGameState) => {
  const parsed = normalizeCountryGuess(message.content);
  if (!parsed) {
    return "ignored" as const;
  }

  const rules = await loadRules();
  const player = await upsertPlayer(message.author, message.member?.displayName);
  await ensurePlayerStat(player.id);

  const canBypassGmBlock = canBypassGameMasterBlock(
    state,
    message.channel.id,
    message.author.id,
    rules,
  );

  if (message.author.id === state.gameMasterDiscordUserId && !canBypassGmBlock) {
    return "game-master-blocked" as const;
  }

  const isCorrect = parsed.countryCode === state.targetCountryCode;
  const isRepeat = !isCorrect && (await hasWrongCountry(state.gameId, parsed.countryCode));
  const now = Date.now();

  // Test games and repeat guesses do not consume the consecutive-guess limit.
  if (!state.isTest && !isRepeat) {
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
        parsed.countryCode,
        parsed.displayName,
        parsed.strategy,
        false,
        false,
        true,
        "⏳",
      );
      return "rate-limited" as const;
    }

    await redis.set(
      keys.guessStreaks(state.gameId),
      JSON.stringify(
        nextStreaks(streaks, message.author.id, now, rules.consecutiveGuessIdleResetSeconds),
      ),
    );
  }

  const reaction = isCorrect ? "✅" : isRepeat ? "🔄" : "❌";
  const guessId = await persistGuess(
    message,
    state,
    player.id,
    parsed.countryCode,
    parsed.displayName,
    parsed.strategy,
    isCorrect,
    isRepeat,
    false,
    reaction,
  );

  if (!isCorrect && !isRepeat) {
    await addWrongCountry(state.gameId, parsed.countryCode);
  }

  state.lastGuessAt = now;
  await updateGameState(state);

  if (isCorrect) {
    return completeGame(message, state, player.id, guessId);
  }

  return reaction;
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
  const rows = await sqlClient.begin(async (tx) => {
    const guessRows = await tx`
      INSERT INTO guess (
        game_id,
        player_id,
        discord_message_id,
        raw_message,
        parsed_country_code,
        parsed_country_name,
        parser_strategy,
        is_correct,
        is_repeat,
        is_rate_limited,
        reaction
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
        ${reaction}
      )
      RETURNING id
    `;

    if (!isRateLimitedValue && !state.isTest) {
      await tx`
        UPDATE game
        SET
          total_guess_count = total_guess_count + 1,
          wrong_guess_count = wrong_guess_count + ${isCorrect || isRepeat ? 0 : 1},
          unique_wrong_country_count = unique_wrong_country_count + ${isCorrect || isRepeat ? 0 : 1},
          repeat_guess_count = repeat_guess_count + ${isRepeat ? 1 : 0},
          updated_at = now()
        WHERE id = ${state.gameId}
      `;

      await tx`
        INSERT INTO player_game (player_id, game_id, role, guess_count, unique_wrong_guess_count, repeat_guess_count, first_guess_at, last_guess_at)
        VALUES (${playerId}, ${state.gameId}, 'player', 1, ${isCorrect || isRepeat ? 0 : 1}, ${isRepeat ? 1 : 0}, now(), now())
        ON CONFLICT (player_id, game_id, role)
        DO UPDATE SET
          guess_count = player_game.guess_count + 1,
          unique_wrong_guess_count = player_game.unique_wrong_guess_count + ${isCorrect || isRepeat ? 0 : 1},
          repeat_guess_count = player_game.repeat_guess_count + ${isRepeat ? 1 : 0},
          last_guess_at = now(),
          updated_at = now()
      `;

      await tx`
        UPDATE player_stat
        SET
          games_participated = games_participated + CASE WHEN NOT EXISTS (
            SELECT 1 FROM player_game pg WHERE pg.player_id = ${playerId} AND pg.game_id = ${state.gameId} AND pg.role = 'player' AND pg.guess_count > 1
          ) THEN 1 ELSE 0 END,
          total_guesses = total_guesses + 1,
          correct_guesses = correct_guesses + ${isCorrect ? 1 : 0},
          wrong_guesses = wrong_guesses + ${isCorrect || isRepeat ? 0 : 1},
          repeat_guesses = repeat_guesses + ${isRepeat ? 1 : 0},
          updated_at = now()
        WHERE player_id = ${playerId}
      `;

      await tx`
        INSERT INTO country_stat (country_code, times_guessed, times_guessed_wrong, times_guessed_correct)
        VALUES (${countryCode}, 1, ${isCorrect ? 0 : 1}, ${isCorrect ? 1 : 0})
        ON CONFLICT (country_code)
        DO UPDATE SET
          times_guessed = country_stat.times_guessed + 1,
          times_guessed_wrong = country_stat.times_guessed_wrong + ${isCorrect ? 0 : 1},
          times_guessed_correct = country_stat.times_guessed_correct + ${isCorrect ? 1 : 0},
          updated_at = now()
      `;
    }

    if (!isRateLimitedValue && state.isTest) {
      await tx`
        UPDATE game
        SET
          total_guess_count = total_guess_count + 1,
          wrong_guess_count = wrong_guess_count + ${isCorrect || isRepeat ? 0 : 1},
          unique_wrong_country_count = unique_wrong_country_count + ${isCorrect || isRepeat ? 0 : 1},
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
  const wrongCountries = await getWrongCountries(state.gameId);
  const points = state.isTest
    ? 0
    : calculateReward(state.basePoints, state.currentMultiplier, state.gmMultiplier);

  await sqlClient.begin(async (tx) => {
    await tx`
      UPDATE game
      SET
        status = 'completed',
        ended_at = now(),
        winner_player_id = ${winnerPlayerId},
        winning_guess_id = ${guessId},
        current_multiplier_final = ${state.currentMultiplier},
        points_awarded = ${points},
        updated_at = now()
      WHERE id = ${state.gameId}
    `;

    if (!state.isTest) {
      await tx`
        INSERT INTO point_ledger (player_id, game_id, reason, base_points, current_multiplier, gm_multiplier, points_delta)
        VALUES (${winnerPlayerId}, ${state.gameId}, 'game_win', ${state.basePoints}, ${state.currentMultiplier}, ${state.gmMultiplier}, ${points})
      `;

      await tx`
        UPDATE player_stat
        SET
          games_won = games_won + 1,
          points_total = points_total + ${points},
          best_single_game_points = GREATEST(best_single_game_points, ${points}),
          updated_at = now()
        WHERE player_id = ${winnerPlayerId}
      `;

      await tx`
        INSERT INTO player_game (player_id, game_id, role, guess_count)
        VALUES (${winnerPlayerId}, ${state.gameId}, 'winner', 0)
        ON CONFLICT (player_id, game_id, role) DO NOTHING
      `;

      for (const milestone of earnedMilestonesForGuessCount(wrongCountries.length)) {
        await tx`
          INSERT INTO game_master_milestone (player_id, milestone_guess_count, game_id)
          VALUES (${state.gameMasterPlayerId}, ${milestone}, ${state.gameId})
          ON CONFLICT (player_id, milestone_guess_count) DO NOTHING
        `;
      }

      const milestoneRows = await tx`
        SELECT COUNT(*)::integer AS count
        FROM game_master_milestone
        WHERE player_id = ${state.gameMasterPlayerId}
      `;
      const gmMultiplier = Math.min(3, 1 + Number(milestoneRows[0]?.count ?? 0) * 0.1);
      await tx`
        UPDATE player_stat
        SET
          current_gm_multiplier = ${gmMultiplier},
          max_game_wrong_guess_count_as_gm = GREATEST(max_game_wrong_guess_count_as_gm, ${wrongCountries.length}),
          updated_at = now()
        WHERE player_id = ${state.gameMasterPlayerId}
      `;
    }
  });

  const locationRows = await sqlClient`
    SELECT
      l.original_google_maps_url,
      l.resolved_google_maps_url,
      l.region_name,
      l.latitude,
      l.longitude
    FROM game g
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

  await clearActiveGame(state);
  await removeMultiplierJobsForGame(state.gameId);

  const hash = mapHash(wrongCountries, state.targetCountryCode);
  const cached = await getCachedMap(state.gameId, "world", hash);
  const map = cached
    ? { buffer: cached, filename: messages.filenames.worldGuesses }
    : renderMap({
        wrongCountries,
        correctCountry: state.targetCountryCode,
        viewport: "world",
      });
  if (!cached) {
    await setCachedMap(state.gameId, "world", hash, map.buffer);
  }
  const attachment = new AttachmentBuilder(map.buffer, { name: map.filename });

  await message.channel.send({
    content: [
      messages.game.foundCountry(
        message.author.id,
        getCountryDisplayName(state.targetCountryCode, messages.locale),
      ),
      googleMapsUrl && latitude != null && longitude != null
        ? messages.game.locationDetails({
            regionName: location?.region_name ?? state.targetRegionName ?? undefined,
            googleMapsUrl,
            latitude,
            longitude,
          })
        : undefined,
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

  return "✅" as const;
};
