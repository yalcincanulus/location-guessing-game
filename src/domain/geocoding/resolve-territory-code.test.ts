import { describe, expect, test } from "bun:test";
import { resolveTerritoryCountryCode } from "./resolve-territory-code.ts";

describe("resolveTerritoryCountryCode", () => {
  test("maps Réunion ISO3166-2 to RE when country_code is fr", () => {
    const resolved = resolveTerritoryCountryCode({
      town: "Saint-Benoît",
      state: "Réunion",
      "ISO3166-2-lvl4": "FR-RE",
      "ISO3166-2-lvl3": "FR-974",
      country: "France",
      country_code: "fr",
    });
    expect(resolved.countryCode).toBe("RE");
  });

  test("maps Guadeloupe department code FR-971 to GP", () => {
    const resolved = resolveTerritoryCountryCode({
      state: "Guadeloupe",
      "ISO3166-2-lvl4": "FR-971",
      country: "France",
      country_code: "fr",
    });
    expect(resolved.countryCode).toBe("GP");
  });

  test("maps Puerto Rico ISO3166-2 to PR when country_code is us", () => {
    const resolved = resolveTerritoryCountryCode({
      state: "Puerto Rico",
      "ISO3166-2-lvl4": "US-PR",
      country: "United States",
      country_code: "us",
    });
    expect(resolved.countryCode).toBe("PR");
  });

  test("maps Hong Kong ISO3166-2 to HK when country_code is cn", () => {
    const resolved = resolveTerritoryCountryCode({
      city: "Hong Kong",
      "ISO3166-2-lvl3": "CN-HK",
      country: "China",
      country_code: "cn",
    });
    expect(resolved.countryCode).toBe("HK");
  });

  test("keeps metropolitan France as FR", () => {
    const resolved = resolveTerritoryCountryCode({
      state: "Île-de-France",
      "ISO3166-2-lvl4": "FR-IDF",
      country: "France",
      country_code: "fr",
    });
    expect(resolved.countryCode).toBe("FR");
  });

  test("keeps territories that already have their own country_code", () => {
    const resolved = resolveTerritoryCountryCode({
      city: "Gibraltar",
      country: "Gibraltar",
      country_code: "gi",
    });
    expect(resolved.countryCode).toBe("GI");
  });

  test("falls back to state name when ISO3166-2 is missing", () => {
    const resolved = resolveTerritoryCountryCode({
      state: "Réunion",
      country: "France",
      country_code: "fr",
    });
    expect(resolved.countryCode).toBe("RE");
  });
});
