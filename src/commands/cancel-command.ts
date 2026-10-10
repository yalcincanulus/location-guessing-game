import type { ButtonInteraction, Message, User } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { loadRules } from "../config/rules.ts";
import { sqlClient } from "../db/client.ts";
import {
  gameModeOf,
  getActiveGameState,
  type ActiveGameState,
} from "../domain/game/active-game-state.ts";
import { cancelOrFailActiveGame } from "../domain/game/admin-game-ops.ts";
import { tablesFor } from "../domain/game/game-mode.ts";
import { messages } from "../i18n/messages.ts";

export const CANCEL_COMMANDS = ["cancel", "iptal"];

const CANCEL_BUTTON_PREFIX = "player-cancel";

const countGuesses = async (state: ActiveGameState) => {
  const rows = await sqlClient`
    SELECT COUNT(*)::integer AS count
    FROM ${sqlClient(tablesFor(gameModeOf(state)).guess)}
    WHERE game_id = ${state.gameId}
  `;
  return Number(rows[0]?.count ?? 0);
};

/** Ends the game and announces it in its channel. False when the game is no longer active. */
const cancelGame = async (
  message: Pick<Message, "client">,
  state: ActiveGameState,
  user: User,
  displayName?: string,
) => {
  const result = await cancelOrFailActiveGame({
    guildId: state.guildId,
    channelId: state.channelId,
    mode: gameModeOf(state),
    status: "cancelled",
    reason: "player cancel",
    cancelledBy: user,
    displayName,
    expectedGameId: state.gameId,
  });
  if (!result.ok) {
    return false;
  }

  const channel = await message.client.channels.fetch(state.channelId).catch(() => null);
  if (channel?.isSendable()) {
    await channel.send(messages.cancel.announcement(user.id)).catch(() => undefined);
  }
  return true;
};

const confirmButtons = (state: ActiveGameState) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CANCEL_BUTTON_PREFIX}:confirm:${state.channelId}:${state.gameId}`)
      .setLabel(messages.cancel.confirmButton)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${CANCEL_BUTTON_PREFIX}:keep:${state.channelId}:${state.gameId}`)
      .setLabel(messages.cancel.keepButton)
      .setStyle(ButtonStyle.Secondary),
  );

/** Active games the author started: this channel's game, or every game channel's game in DM. */
const ownActiveGames = async (message: Message) => {
  if (message.inGuild()) {
    const state = await getActiveGameState(message.guild.id, message.channel.id);
    return state?.gameMasterDiscordUserId === message.author.id ? [state] : [];
  }

  const rules = await loadRules();
  const channelIds = new Set(
    [
      rules.gameChannelId,
      rules.provinceGameChannelId,
      rules.testModeEnabled ? rules.testChannelId : undefined,
      rules.testModeEnabled ? rules.provinceTestChannelId : undefined,
    ].filter((id): id is string => Boolean(id)),
  );

  const games: ActiveGameState[] = [];
  for (const channelId of channelIds) {
    const channel = await message.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !("guild" in channel) || !channel.guild) {
      continue;
    }
    const state = await getActiveGameState(channel.guild.id, channel.id);
    if (state?.gameMasterDiscordUserId === message.author.id) {
      games.push(state);
    }
  }
  return games;
};

/**
 * `!cancel` / `!iptal` from the game master, in the game channel or in DM. A game
 * without guesses ends at once. Otherwise the player confirms with buttons in DM,
 * so nobody else sees them.
 */
export const cancelOwnGames = async (message: Message) => {
  const games = await ownActiveGames(message);
  if (games.length === 0) {
    await message.reply(messages.cancel.noOwnActiveGame);
    return true;
  }

  const displayName = message.inGuild() ? message.member?.displayName : undefined;
  for (const state of games) {
    const guessCount = await countGuesses(state);
    if (guessCount === 0) {
      const cancelled = await cancelGame(message, state, message.author, displayName);
      if (!message.inGuild()) {
        await message.reply(
          cancelled ? messages.cancel.cancelled(state.channelId) : messages.cancel.noLongerActive,
        );
      }
      continue;
    }

    const prompt = {
      content: messages.cancel.confirmPrompt(state.channelId, guessCount),
      components: [confirmButtons(state)],
    };
    if (!message.inGuild()) {
      await message.reply(prompt);
      continue;
    }

    const sent = await message.author.send(prompt).catch(() => null);
    if (sent) {
      await message.react("📬").catch(() => undefined);
    } else {
      await message.reply(messages.cancel.dmFailed(message.author.id));
    }
  }
  return true;
};

/** Handles the confirm / keep buttons. Returns false for other buttons. */
export const handleCancelButton = async (interaction: ButtonInteraction) => {
  const [prefix, action, channelId, gameId] = interaction.customId.split(":");
  if (prefix !== CANCEL_BUTTON_PREFIX || !channelId || !gameId) {
    return false;
  }

  if (action !== "confirm") {
    await interaction.update({ content: messages.cancel.kept, components: [] });
    return true;
  }

  await interaction.deferUpdate();
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  const state =
    channel && "guild" in channel && channel.guild
      ? await getActiveGameState(channel.guild.id, channelId)
      : undefined;
  const cancelled =
    state?.gameId === gameId &&
    state.gameMasterDiscordUserId === interaction.user.id &&
    (await cancelGame(interaction, state, interaction.user));

  await interaction.editReply({
    content: cancelled ? messages.cancel.cancelled(channelId) : messages.cancel.noLongerActive,
    components: [],
  });
  return true;
};
