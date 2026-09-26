import type { BotLocale } from "../../i18n/locale.ts";
import {
  getCountryDisplayName,
  normalizeCountryGuess,
} from "../countries/normalize-country-guess.ts";
import { getProvinceName, normalizeProvinceGuess } from "../provinces/normalize-province-guess.ts";
import type { GameMode } from "./game-mode.ts";

export type ParsedGuess = {
  /** ISO alpha-2 country code, or a province plate code. */
  code: string;
  displayName: string;
  strategy: string;
};

export const parseGuessForMode = (mode: GameMode, content: string): ParsedGuess | undefined => {
  if (mode === "province") {
    const parsed = normalizeProvinceGuess(content);
    return parsed
      ? { code: parsed.provinceCode, displayName: parsed.displayName, strategy: parsed.strategy }
      : undefined;
  }

  const parsed = normalizeCountryGuess(content);
  return parsed
    ? { code: parsed.countryCode, displayName: parsed.displayName, strategy: parsed.strategy }
    : undefined;
};

/** Display name for a target code in the given mode. */
export const targetDisplayName = (mode: GameMode, code: string, locale: BotLocale) =>
  mode === "province" ? getProvinceName(code) : getCountryDisplayName(code, locale);
