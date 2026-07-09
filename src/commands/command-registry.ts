import type { Message } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { loadRules } from "../config/rules.ts";
import {
  getActiveGameState,
  getCachedMap,
  getWrongCountries,
  mapHash,
  setCachedMap,
} from "../domain/game/active-game-state.ts";
import { renderMap } from "../domain/maps/map-renderer.ts";
import { viewportAliases } from "../domain/maps/region-presets.ts";
import { getLeaderboard, getPlayerProfile } from "../repositories/core-repository.ts";
import { sqlClient } from "../db/client.ts";
import { handleTestCommand } from "./test-command.ts";
import { messages } from "../i18n/messages.ts";

const normalizeCommand = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

export const isCommandMessage = async (content: string) => {
  const rules = await loadRules();
  return rules.commandPrefixes.some((prefix) => content.startsWith(prefix));
};

export const handleCommand = async (message: Message<true>) => {
  const rules = await loadRules();
  const prefix = rules.commandPrefixes.find((candidate) => message.content.startsWith(candidate));
  if (!prefix) {
    return false;
  }

  const command = normalizeCommand(message.content.slice(prefix.length).split(/\s+/)[0] ?? "");
  if (!command) {
    return false;
  }
  const args = message.content.slice(prefix.length).trim().split(/\s+/).slice(1);

  await sqlClient`
    INSERT INTO command_log (command, raw_message)
    VALUES (${command}, ${message.content})
  `;

  if (command === "test") {
    return handleTestCommand(message, args);
  }

  const viewport = viewportAliases.get(command);
  if (viewport) {
    const state = await getActiveGameState(message.guild.id, message.channel.id);
    if (!state) {
      await message.reply(messages.commands.noActiveGameInChannel);
      return true;
    }

    const wrongCountries = await getWrongCountries(state.gameId);
    const hash = mapHash(wrongCountries);
    const cached = await getCachedMap(state.gameId, viewport, hash);
    const map = cached
      ? {
          buffer: cached,
          filename: `${viewport}-guesses.png`,
        }
      : renderMap({ wrongCountries, viewport });
    if (!cached) {
      await setCachedMap(state.gameId, viewport, hash, map.buffer);
    }
    await message.channel.send({
      files: [new AttachmentBuilder(map.buffer, { name: map.filename })],
    });
    return true;
  }

  if (["ss", "screenshot", "ekran"].includes(command)) {
    const state = await getActiveGameState(message.guild.id, message.channel.id);
    if (!state) {
      await message.reply(messages.commands.noActiveGameInChannel);
      return true;
    }

    const response = await fetch(state.screenshotUrl);
    if (!response.ok) {
      await message.reply(messages.commands.couldNotLoadScreenshot);
      return true;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const filename =
      new URL(state.screenshotUrl).pathname.split("/").pop() ||
      messages.filenames.fallbackScreenshot;
    await message.channel.send({
      files: [new AttachmentBuilder(buffer, { name: filename })],
    });
    return true;
  }

  if (["profile", "profil"].includes(command)) {
    const profile = await getPlayerProfile(message.author.id);
    if (!profile) {
      await message.reply(messages.commands.noProfileYet);
      return true;
    }

    const participated = Number(profile.games_participated ?? 0);
    const wins = Number(profile.games_won ?? 0);
    const winRate = participated === 0 ? 0 : Math.round((wins / participated) * 100);
    await message.reply(
      messages.commands.profile({
        displayName: profile.display_name,
        points: profile.points_total ?? 0,
        wins,
        participated,
        winRate,
        gamesStarted: profile.games_started ?? 0,
        guesses: profile.total_guesses ?? 0,
        gmMultiplier: Number(profile.current_gm_multiplier ?? 1),
      }),
    );
    return true;
  }

  if (["leaderboard", "liderlik", "top"].includes(command)) {
    const arg = normalizeCommand(message.content.slice(prefix.length).split(/\s+/)[1] ?? "points");
    const kind =
      arg === "wins" || arg === "win"
        ? "wins"
        : arg === "started"
          ? "started"
          : arg === "hardest"
            ? "hardest"
            : "points";
    const rows = await getLeaderboard(kind);
    const lines = rows.map((row, index) =>
      messages.commands.leaderboardRow(index + 1, row.display_name, row.value),
    );
    await message.reply(lines.length > 0 ? lines.join("\n") : messages.commands.noLeaderboardData);
    return true;
  }

  if (["stats", "istatistik"].includes(command)) {
    const rows = await sqlClient`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_games,
        COUNT(*) AS total_games,
        COALESCE(SUM(total_guess_count), 0) AS total_guesses
      FROM game
    `;
    const row = rows[0];
    await message.reply(
      messages.commands.stats({
        completedGames: row?.completed_games ?? 0,
        totalGames: row?.total_games ?? 0,
        totalGuesses: row?.total_guesses ?? 0,
      }),
    );
    return true;
  }

  if (["help", "yardim"].includes(command)) {
    const isTestAdmin =
      rules.testModeEnabled &&
      rules.testChannelId === message.channel.id &&
      rules.testAdminUserIds.includes(message.author.id);
    await message.reply(
      [messages.commands.helpCommands, isTestAdmin ? messages.commands.helpTestCommands : undefined]
        .filter(Boolean)
        .join("\n"),
    );
    return true;
  }

  return false;
};
