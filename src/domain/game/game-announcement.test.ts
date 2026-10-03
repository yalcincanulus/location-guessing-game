import { describe, expect, test } from "bun:test";
import { buildGameAnnouncement } from "./game-announcement.ts";

const screenshot = { buffer: Buffer.from([1, 2, 3]), name: "screenshot.png" };

describe("game start announcement", () => {
  test("uses plain content with the screenshot attached so older clients can render it", () => {
    const announcement = buildGameAnnouncement("New round", screenshot);
    expect(announcement.content).toBe("New round");
    expect(announcement.components).toBeUndefined();
    expect(announcement.flags).toBeUndefined();
    expect(announcement.files).toHaveLength(1);
  });
});
