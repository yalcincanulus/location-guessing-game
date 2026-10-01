import { describe, expect, test } from "bun:test";
import { ComponentType, MessageFlags } from "discord.js";
import { enMessages } from "../../i18n/en.ts";
import { trMessages } from "../../i18n/tr.ts";
import { buildGameAnnouncement } from "./game-announcement.ts";

const screenshot = { buffer: Buffer.from([1, 2, 3]), name: "screenshot.png" };

describe("game start announcement", () => {
  for (const messages of [enMessages, trMessages]) {
    test(`places the ${messages.locale} reminder below the attached screenshot`, () => {
      const content = messages.start.gameStarted("123", {
        inTheGame: true,
        coverageSource: "google",
      });
      const announcement = buildGameAnnouncement(content, screenshot, messages.fairPlay.reminder);
      const components = JSON.parse(JSON.stringify(announcement.components));
      expect(announcement.flags).toBe(MessageFlags.IsComponentsV2);
      expect(announcement.content).toBeUndefined();
      expect(components.map((component: { type: number }) => component.type)).toEqual([
        ComponentType.TextDisplay,
        ComponentType.MediaGallery,
        ComponentType.TextDisplay,
      ]);
      expect(components[0].content).toBe(content);
      expect(components[1].items[0].media.url).toBe("attachment://screenshot.png");
      expect(components[2].content).toBe(`-# ${messages.fairPlay.reminder}`);
      expect(announcement.files).toHaveLength(1);
    });
  }

  test("keeps the original announcement layout when notices are disabled", () => {
    const announcement = buildGameAnnouncement("New round", screenshot);
    expect(announcement.content).toBe("New round");
    expect(announcement.components).toBeUndefined();
    expect(announcement.flags).toBeUndefined();
    expect(announcement.files).toHaveLength(1);
  });
});
