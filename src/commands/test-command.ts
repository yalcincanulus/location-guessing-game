import type { Message } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { loadRules } from "../config/rules.ts";
import {
  cancelOrFailActiveGame,
  getActiveGameContext,
} from "../domain/game/admin-game-ops.ts";
import { getWrongCountries } from "../domain/game/active-game-state.ts";
import { countries } from "../domain/countries/country-data.ts";
import { getCountryDisplayName } from "../domain/countries/normalize-country-guess.ts";
import { renderMap } from "../domain/maps/map-renderer.ts";
import { runIdleMultiplierCheck } from "../jobs/queues.ts";
import { messages } from "../i18n/messages.ts";

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

const deny = async (message: Message<true>, reason: string) => {
  await message.reply(reason);
  return true;
};

const authorize = async (message: Message<true>) => {
  const rules = await loadRules(true);
  if (!rules.testModeEnabled) {
    return { ok: false as const, reason: messages.test.modeDisabled };
  }

  if (message.channel.id !== rules.testChannelId) {
    return {
      ok: false as const,
      reason: messages.test.onlyInTestChannel,
    };
  }

  if (!rules.testAdminUserIds.includes(message.author.id)) {
    return {
      ok: false as const,
      reason: messages.test.notEnabledForUser,
    };
  }

  return { ok: true as const, rules };
};

const cancelOrFailGame = async (
  message: Message<true>,
  status: "cancelled" | "failed",
  reason: string,
) => {
  const result = await cancelOrFailActiveGame({
    guildId: message.guild.id,
    channelId: message.channel.id,
    status,
    reason,
    cancelledBy: message.author,
    displayName: message.member?.displayName,
  });

  if (!result.ok) {
    await message.reply(messages.test.noActiveGameInTestChannel);
    return true;
  }

  await message.reply(
    status === "cancelled"
      ? messages.test.cancelledGame(result.gameId)
      : messages.test.resetGameState,
  );
  return true;
};

const statusCommand = async (message: Message<true>) => {
  const { state, dbGame, redisMissingButDbActive } = await getActiveGameContext(
    message.guild.id,
    message.channel.id,
  );
  const wrongCountries = state ? await getWrongCountries(state.gameId) : [];
  const target = dbGame
    ? `${dbGame.countryCode} - ${dbGame.countryName ?? getCountryDisplayName(dbGame.countryCode, messages.locale)}`
    : undefined;

  await message.reply(
    messages.test.status({
      game:
        dbGame && target
          ? {
              id: dbGame.gameId,
              status: dbGame.status,
              gameMasterDiscordUserId: dbGame.gameMasterDiscordUserId,
              target,
              regionName: dbGame.regionName,
            }
          : undefined,
      wrongCountryCount: wrongCountries.length,
      currentMultiplier: state?.currentMultiplier ?? dbGame?.currentMultiplier ?? 1,
      isTestGame: state?.isTest ?? dbGame?.isTest ?? false,
      redisMissingButDbActive,
    }),
  );
  return true;
};

const revealCommand = async (message: Message<true>) => {
  const { dbGame, redisMissingButDbActive } = await getActiveGameContext(
    message.guild.id,
    message.channel.id,
  );
  if (!dbGame) {
    await message.reply(messages.test.noActiveGameInTestChannel);
    return true;
  }

  await message.reply(
    messages.test.reveal({
      redisMissingButDbActive,
      answer: `${dbGame.countryCode} - ${
        dbGame.countryName ?? getCountryDisplayName(dbGame.countryCode, messages.locale)
      }`,
      regionName: dbGame.regionName,
      latitude: dbGame.latitude,
      longitude: dbGame.longitude,
    }),
  );
  return true;
};

const tickCommand = async (message: Message<true>) => {
  const { state, dbGame } = await getActiveGameContext(message.guild.id, message.channel.id);
  const gameId = state?.gameId ?? dbGame?.gameId;
  if (!gameId) {
    await message.reply(messages.test.noActiveGameInTestChannel);
    return true;
  }

  const result = await runIdleMultiplierCheck(message.client, gameId, { force: true });
  if (result.status === "missing-game") {
    await message.reply(messages.test.noActiveGameInTestChannel);
    return true;
  }

  if (result.status === "capped") {
    await message.reply(messages.test.multiplierCapped(result.currentMultiplier));
    return true;
  }

  if (result.status === "increased") {
    await message.reply(
      messages.test.forcedMultiplierTick(result.previousMultiplier, result.newMultiplier),
    );
    return true;
  }

  await message.reply(messages.test.multiplierNoChange);
  return true;
};

const pickRandomCountries = (count: number) => {
  const pool = [...countries];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    const [country] = pool.splice(index, 1);
    if (country) {
      picked.push(country.alpha2);
    }
  }
  return picked;
};

const mapCommand = async (message: Message<true>) => {
  const sample = pickRandomCountries(9);
  const correctCountry = sample[0];
  const wrongCountries = sample.slice(1);
  if (!correctCountry || wrongCountries.length === 0) {
    await message.reply(messages.test.unknownCommand);
    return true;
  }

  const map = renderMap({
    wrongCountries,
    correctCountry,
    viewport: "world",
  });

  await message.channel.send({
    content: messages.test.sampleMap(
      getCountryDisplayName(correctCountry, messages.locale),
      wrongCountries.map((code) => getCountryDisplayName(code, messages.locale)),
    ),
    files: [new AttachmentBuilder(map.buffer, { name: map.filename })],
  });
  return true;
};

export const handleTestCommand = async (message: Message<true>, args: string[]) => {
  const auth = await authorize(message);
  if (!auth.ok) {
    return deny(message, auth.reason);
  }

  const subcommand = normalize(args[0] ?? "status");
  if (["status", "durum"].includes(subcommand)) {
    return statusCommand(message);
  }

  if (["cancel", "iptal"].includes(subcommand)) {
    const reason = args.slice(1).join(" ").trim() || "test cancel";
    return cancelOrFailGame(message, "cancelled", reason);
  }

  if (["reveal", "cevap"].includes(subcommand)) {
    return revealCommand(message);
  }

  if (["tick", "multiplier", "mult", "carpan", "çarpan"].includes(subcommand)) {
    return tickCommand(message);
  }

  if (["reset", "sifirla", "sıfırla"].includes(subcommand)) {
    return cancelOrFailGame(message, "failed", "test reset");
  }

  if (["map", "harita"].includes(subcommand)) {
    return mapCommand(message);
  }

  await message.reply(messages.test.unknownCommand);
  return true;
};
