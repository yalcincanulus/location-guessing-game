import type { Message } from "discord.js";
import { loadRules } from "../config/rules.ts";
import { MAX_FEEDBACK_LENGTH, parseFeedbackCommand } from "../domain/feedback.ts";
import { findPlayerByDiscordUserId } from "../repositories/core-repository.ts";
import { createFeedback } from "../repositories/feedback-repository.ts";
import { consumeFeedbackRateLimit } from "../repositories/feedback-rate-limit-repository.ts";
import { messages } from "../i18n/messages.ts";

export const handleFeedbackCommand = async (message: Message): Promise<boolean> => {
  if (message.inGuild()) {
    return false;
  }

  const rules = await loadRules();
  const parsed = parseFeedbackCommand(message.content, rules.commandPrefixes);
  if (!parsed) {
    return false;
  }

  if (!parsed.message) {
    await message.reply(messages.feedback.usage);
    return true;
  }

  if (parsed.message.length > MAX_FEEDBACK_LENGTH) {
    await message.reply(messages.feedback.tooLong(MAX_FEEDBACK_LENGTH));
    return true;
  }

  const player = await findPlayerByDiscordUserId(message.author.id);
  if (!player) {
    await message.reply(messages.feedback.playerNotFound);
    return true;
  }

  const rateLimit = await consumeFeedbackRateLimit(message.author.id, message.id);
  if (!rateLimit.allowed) {
    await message.reply(
      messages.feedback.rateLimited(Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60))),
    );
    return true;
  }

  await createFeedback({
    playerId: player.id,
    discordMessageId: message.id,
    message: parsed.message,
  });
  await message.reply(messages.feedback.saved);
  return true;
};
