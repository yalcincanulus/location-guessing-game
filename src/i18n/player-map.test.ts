import { describe, expect, test } from "bun:test";
import { enMessages } from "./en.ts";
import { trMessages } from "./tr.ts";

describe("player map copy", () => {
  test("identifies both map kinds and modes, including finished starts and zero totals", () => {
    expect(enMessages.playerMap.title("wins", "country")).toBe("Win map · Countries");
    expect(enMessages.playerMap.title("starts", "province")).toBe(
      "Start map · Provinces of Türkiye",
    );
    expect(trMessages.playerMap.title("wins", "province")).toBe(
      "Galibiyet haritası · Türkiye'nin illeri",
    );
    expect(enMessages.playerMap.summary("starts", "country", 4, 2)).toBe(
      "Games started: 4 · Countries: 2",
    );
    expect(trMessages.playerMap.summary("wins", "province", 0, 0)).toBe(
      "Kazanılan oyun: 0 · İl: 0",
    );
    expect(trMessages.playerMap.summary("starts", "province", 31, 8)).toBe(
      "Başlatılan oyun: 31 · İl: 8",
    );
  });

  test("dates use Istanbul time and each locale even across midnight UTC", () => {
    const date = new Date("2026-10-07T22:20:00Z");
    expect(enMessages.playerMap.generatedAt(date)).toBe("8 Oct 2026, 01:20");
    expect(trMessages.playerMap.generatedAt(date)).toBe("8 Eki 2026 01:20");
  });

  test.each([enMessages, trMessages])(
    "documents maps in both modes without exceeding Discord's limit",
    (messages) => {
      for (const help of [messages.commands.helpCommands, messages.province.helpCommands]) {
        expect(help).toContain("!winmap");
        expect(help).toContain("!startmap");
        expect(help.length).toBeLessThanOrEqual(2000);
      }
    },
  );
});
