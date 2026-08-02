import { countries } from "./country-data.ts";
import type { BotLocale } from "../../i18n/locale.ts";

export type ParsedCountryGuess = {
  countryCode: string;
  displayName: string;
  strategy: "alpha2" | "alpha3" | "alias";
};

const englishNames = new Intl.DisplayNames(["en"], { type: "region" });
const turkishNames = new Intl.DisplayNames(["tr"], { type: "region" });
const localizedNames: Record<BotLocale, Intl.DisplayNames> = {
  en: englishNames,
  tr: turkishNames,
};

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    // Turkish locale maps ASCII "I" → "ı", while "İ" → "i". Fold so "IT" / "İt" / "it"
    // all share one alias key (otherwise ISO codes indexed from "IT" never match "İt").
    .replaceAll("ı", "i")
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

  if (country.ccTld) {
    const tld = country.ccTld.toLocaleLowerCase("tr");
    aliases.set(normalize(tld), parsed);
    aliases.set(normalize(`.${tld}`), parsed);
  }
}

export const getCountryDisplayName = (countryCode: string, locale: BotLocale = "en") =>
  localizedNames[locale].of(countryCode.toUpperCase()) ??
  displayNames.get(countryCode.toUpperCase()) ??
  countryCode.toUpperCase();

export const getCountryNumericId = (countryCode: string) =>
  numericByAlpha2.get(countryCode.toUpperCase());

const parseSingleGuess = (message: string): ParsedCountryGuess | undefined => {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 64) {
    return undefined;
  }

  // Fold Turkish İ/ı through normalize so compact codes like "İt" still match "IT".
  const compact = normalize(trimmed).replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z]{2}$/.test(compact)) {
    const byAlpha2 = alpha2.get(compact);
    if (byAlpha2) {
      return byAlpha2;
    }
  }

  if (/^[A-Z]{3}$/.test(compact)) {
    const byAlpha3 = alpha3.get(compact);
    if (byAlpha3) {
      return byAlpha3;
    }
  }

  // Fall through so 3-letter nicknames like "abd" / "uae" still match aliases
  // when they are not ISO alpha-3 codes.
  const normalized = normalize(trimmed);
  // Exact aliases are safe to accept regardless of word count; some canonical
  // territory names, including GS, contain more than five words.
  if (!normalized) {
    return undefined;
  }

  return aliases.get(normalized);
};

export const normalizeCountryGuess = (message: string): ParsedCountryGuess | undefined => {
  const trimmed = message.trim();
  if (!trimmed) {
    return undefined;
  }

  const direct = parseSingleGuess(trimmed);
  if (direct) {
    return direct;
  }

  // Multi-line messages: accept the first line that is a valid country guess.
  for (const line of trimmed.split(/\r?\n/)) {
    const parsed = parseSingleGuess(line);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
};

export const isKnownCountryCode = (countryCode: string) =>
  displayNames.has(countryCode.toUpperCase());
