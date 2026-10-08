import { describe, expect, test } from "bun:test";
import { enMessages } from "./en.ts";
import { formatPerGame } from "./stats-format.ts";
import { trMessages } from "./tr.ts";

const sample = {
  completedGames: 88,
  totalGuesses: 415,
  totalPlayers: 120,
  distinctCountries: 41,
  topCountryName: "Fransa",
  topCountryGames: 12,
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
        "Solved on the first guess: **11**",
        "Hosts: **19**",
        "Players per game: **0.00**",
      ].join("\n"),
    );
  });
});

describe("formatPerGame", () => {
  test("returns zero when there is no game to divide by", () => {
    expect(formatPerGame(10, 0, "tr")).toBe("0");
  });
});
