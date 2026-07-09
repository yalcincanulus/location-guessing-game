export type BotLocale = "en" | "tr";

export const defaultLocale: BotLocale = "en";

export const resolveLocale = (value: string | undefined): BotLocale => {
  const normalized = value?.trim().toLocaleLowerCase("tr");
  return normalized === "tr" ? "tr" : defaultLocale;
};
