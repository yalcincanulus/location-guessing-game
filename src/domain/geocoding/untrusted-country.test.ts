import { describe, expect, test } from "bun:test";
import { normalizeCountryGuess } from "../countries/normalize-country-guess.ts";
import { isUntrustedReverseGeocodeCountry } from "./untrusted-country.ts";

describe("isUntrustedReverseGeocodeCountry", () => {
  test("blocks Falkland Islands and South Georgia by code", () => {
    for (const countryCode of ["FK", "fk", "GS", "gs"]) {
      expect(isUntrustedReverseGeocodeCountry(countryCode)).toBe(true);
    }
  });

  test("allows other country codes", () => {
    expect(isUntrustedReverseGeocodeCountry("AR")).toBe(false);
    expect(isUntrustedReverseGeocodeCountry("AQ")).toBe(false);
  });

  test("full country names resolve to blocked codes", () => {
    for (const [guess, countryCode] of [
      ["falkland islands", "FK"],
      ["south georgia and the south sandwich islands", "GS"],
    ] as const) {
      const parsed = normalizeCountryGuess(guess);
      expect(parsed?.countryCode).toBe(countryCode);
      expect(isUntrustedReverseGeocodeCountry(parsed?.countryCode ?? "")).toBe(true);
    }
  });
});
