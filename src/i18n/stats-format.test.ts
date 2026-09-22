import { describe, expect, test } from "bun:test";
import { enMessages } from "./en.ts";
import { formatMedianDuration, formatPerGame } from "./stats-format.ts";
import { trMessages } from "./tr.ts";

const sample = {
  completedGames: 88,
  totalGuesses: 415,
  totalPlayers: 120,
  distinctCountries: 41,
  topCountryName: "Fransa",
  topCountryGames: 12,
  medianSolveSeconds: 18 * 60,
  oneshotGames: 11,
  hosts: 19,
  participations: 299,
};

describe("stats message", () => {
  test("formats the Turkish summary without a points line", () => {
    expect(trMessages.commands.stats(sample)).toBe(
      [
        "Tamamlanan oyun: **88**",
        "Toplam tahmin: **415**",
        "Toplam oyuncu: **120**",
        "Oyun başına tahmin: **4,72**",
        "Farklı ülke: **41**",
        "En çok çıkan ülke: **Fransa** (12)",
        "Ortanca süre: **18 dk**",
        "Tek tahminde biten: **11**",
        "Oyun kurucu: **19**",
        "Oyun başına oyuncu: **3,40**",
      ].join("\n"),
    );
  });

  test("formats the English summary and an empty country", () => {
    expect(
      enMessages.commands.stats({
        ...sample,
        topCountryName: null,
        medianSolveSeconds: null,
        participations: 0,
      }),
    ).toBe(
      [
        "Completed games: **88**",
        "Total guesses: **415**",
        "Total players: **120**",
        "Guesses per game: **4.72**",
        "Distinct countries: **41**",
        "Most common country: **—**",
        "Median time: **—**",
        "Solved on the first guess: **11**",
        "Hosts: **19**",
        "Players per game: **0.00**",
      ].join("\n"),
    );
  });
});

describe("formatMedianDuration", () => {
  test("keeps short solves in seconds and long solves in hours", () => {
    expect(formatMedianDuration(50, "tr")).toBe("50 sn");
    expect(formatMedianDuration(50, "en")).toBe("50s");
    expect(formatMedianDuration(90 * 60, "tr")).toBe("1 sa 30 dk");
    expect(formatMedianDuration(90 * 60, "en")).toBe("1 hr 30 min");
    expect(formatMedianDuration(null, "tr")).toBe("—");
  });
});

describe("formatPerGame", () => {
  test("returns zero when there is no game to divide by", () => {
    expect(formatPerGame(10, 0, "tr")).toBe("0");
  });
});
