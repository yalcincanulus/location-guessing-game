import { describe, expect, test } from "bun:test";
import { isKnownCountryCode, normalizeCountryGuess } from "./normalize-country-guess.ts";

describe("normalizeCountryGuess overseas territories", () => {
  test("accepts Réunion by code, name, and ccTLD", () => {
    for (const guess of ["re", "RE", "Réunion", "reunion", ".re"]) {
      expect(normalizeCountryGuess(guess)?.countryCode).toBe("RE");
    }
  });

  test("keeps France as a separate country", () => {
    expect(normalizeCountryGuess("france")?.countryCode).toBe("FR");
    expect(normalizeCountryGuess("FR")?.countryCode).toBe("FR");
    expect(normalizeCountryGuess("fransa")?.countryCode).toBe("FR");
  });

  test("does not map France guesses to Réunion", () => {
    expect(normalizeCountryGuess("france")?.countryCode).not.toBe("RE");
    expect(normalizeCountryGuess("FR")?.countryCode).not.toBe("RE");
  });

  test("accepts other French and UK territory guesses", () => {
    expect(normalizeCountryGuess("guadeloupe")?.countryCode).toBe("GP");
    expect(normalizeCountryGuess(".gp")?.countryCode).toBe("GP");
    expect(normalizeCountryGuess("gibraltar")?.countryCode).toBe("GI");
    expect(normalizeCountryGuess(".gi")?.countryCode).toBe("GI");
    expect(normalizeCountryGuess("cayman")?.countryCode).toBe("KY");
    expect(normalizeCountryGuess("puerto rico")?.countryCode).toBe("PR");
  });

  test("isKnownCountryCode covers territories and rejects unknown codes", () => {
    expect(isKnownCountryCode("RE")).toBe(true);
    expect(isKnownCountryCode("GI")).toBe(true);
    expect(isKnownCountryCode("FR")).toBe(true);
    expect(isKnownCountryCode("ZZ")).toBe(false);
  });

  test("accepts 3-letter nicknames that are not ISO alpha-3 codes", () => {
    expect(normalizeCountryGuess("abd")?.countryCode).toBe("US");
    expect(normalizeCountryGuess("uae")?.countryCode).toBe("AE");
    expect(normalizeCountryGuess("usa")?.countryCode).toBe("US");
  });

  test("accepts Antarctica by code, name, and ccTLD", () => {
    for (const guess of ["aq", "AQ", "antarctica", "antarktika", ".aq"]) {
      expect(normalizeCountryGuess(guess)?.countryCode).toBe("AQ");
    }
  });

  test("treats Turkish İ/I/ı/i as the same letter in guesses", () => {
    for (const guess of ["it", "It", "IT", "İt", "İT", "italya", "İtalya", "ITALYA", "Italy"]) {
      expect(normalizeCountryGuess(guess)?.countryCode).toBe("IT");
    }
  });
});
