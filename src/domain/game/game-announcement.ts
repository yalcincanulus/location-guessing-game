import {
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  TextDisplayBuilder,
  type MessageCreateOptions,
} from "discord.js";

export const buildGameAnnouncement = (
  content: string,
  screenshot: { buffer: Buffer; name: string },
  reminder?: string,
): MessageCreateOptions => {
  const files = [new AttachmentBuilder(screenshot.buffer, { name: screenshot.name })];
  if (!reminder) {
    return { content, files };
  }

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      new TextDisplayBuilder().setContent(content),
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(`attachment://${screenshot.name}`),
      ),
      new TextDisplayBuilder().setContent(`-# ${reminder}`),
    ],
    files,
  };
};
