import type { BotLocale } from "./locale.ts";

const localeTag = (locale: BotLocale) => (locale === "tr" ? "tr-TR" : "en-US");

export const formatPerGame = (
  numerator: number | string,
  games: number | string,
  locale: BotLocale,
) => {
  const count = Number(games);
  const value = Number(numerator);
  if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(value)) {
    return "0";
  }
  return (value / count).toLocaleString(localeTag(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
