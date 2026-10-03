import { AttachmentBuilder, type MessageCreateOptions } from "discord.js";

// Plain content + attachment only: older Discord clients (common where Discord is
// blocked and clients go unupdated) cannot render Components V2 messages, so the
// fair play reminder is sent as a separate follow-up message instead.
export const buildGameAnnouncement = (
  content: string,
  screenshot: { buffer: Buffer; name: string },
): MessageCreateOptions => ({
  content,
  files: [new AttachmentBuilder(screenshot.buffer, { name: screenshot.name })],
});
