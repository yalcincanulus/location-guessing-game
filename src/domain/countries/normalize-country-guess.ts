import { countries } from "./country-data.ts";

export type ParsedCountryGuess = {
  countryCode: string;
  displayName: string;
  strategy: "alpha2" | "alpha3" | "alias";
};

const englishNames = new Intl.DisplayNames(["en"], { type: "region" });
const turkishNames = new Intl.DisplayNames(["tr"], { type: "region" });

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const alpha2 = new Map<string, ParsedCountryGuess>();
const alpha3 = new Map<string, ParsedCountryGuess>();
const aliases = new Map<string, ParsedCountryGuess>();
const displayNames = new Map<string, string>();
const numericByAlpha2 = new Map<string, string>();

for (const country of countries) {
  const displayName = englishNames.of(country.alpha2) ?? country.alpha2;
  const parsed: ParsedCountryGuess = {
    countryCode: country.alpha2,
    displayName,
    strategy: "alias",
  };

  displayNames.set(country.alpha2, displayName);
  numericByAlpha2.set(country.alpha2, country.numeric);
  alpha2.set(country.alpha2, { ...parsed, strategy: "alpha2" });
  alpha3.set(country.alpha3, { ...parsed, strategy: "alpha3" });

  const names = [
    displayName,
    turkishNames.of(country.alpha2),
    country.alpha2,
    country.alpha3,
    ...(country.aliases ?? []),
  ].filter(Boolean);

  for (const name of names) {
    aliases.set(normalize(String(name)), parsed);
  }
}

export const getCountryDisplayName = (countryCode: string) =>
  displayNames.get(countryCode.toUpperCase()) ?? countryCode.toUpperCase();

export const getCountryNumericId = (countryCode: string) =>
  numericByAlpha2.get(countryCode.toUpperCase());

export const normalizeCountryGuess = (message: string): ParsedCountryGuess | undefined => {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 64) {
    return undefined;
  }

  const compact = trimmed.replace(/[^\p{Letter}\p{Number}]/gu, "").toUpperCase();
  if (/^[A-Z]{2}$/.test(compact)) {
    return alpha2.get(compact);
  }

  if (/^[A-Z]{3}$/.test(compact)) {
    return alpha3.get(compact);
  }

  const normalized = normalize(trimmed);
  if (!normalized || normalized.split(" ").length > 5) {
    return undefined;
  }

  return aliases.get(normalized);
};

export const isKnownCountryCode = (countryCode: string) =>
  displayNames.has(countryCode.toUpperCase());
