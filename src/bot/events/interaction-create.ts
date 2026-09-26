import type { Interaction } from "discord.js";
import { logger } from "../../util/logger.ts";
import { handleStartModeButton } from "./message-create.ts";

export const onInteractionCreate = async (interaction: Interaction) => {
  if (!interaction.isButton()) {
    return;
  }

  try {
    await handleStartModeButton(interaction);
  } catch (error) {
    logger.error("Button handling failed", {
      customId: interaction.customId,
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
