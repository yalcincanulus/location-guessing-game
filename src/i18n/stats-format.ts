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

export const formatMedianDuration = (seconds: number | null, locale: BotLocale) => {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const totalSeconds = Math.round(seconds);
  if (totalSeconds < 60) {
    return locale === "tr" ? `${totalSeconds} sn` : `${totalSeconds}s`;
  }
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) {
    return locale === "tr" ? `${totalMinutes} dk` : `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (locale === "tr") {
    return minutes === 0 ? `${hours} sa` : `${hours} sa ${minutes} dk`;
  }
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
};
