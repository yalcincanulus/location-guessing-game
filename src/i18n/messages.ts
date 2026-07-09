import { env } from "../config/env.ts";
import { enMessages } from "./en.ts";
import { resolveLocale } from "./locale.ts";
import { trMessages } from "./tr.ts";
import type { BotMessages } from "./types.ts";

const catalogs: Record<BotMessages["locale"], BotMessages> = {
  en: enMessages,
  tr: trMessages,
};

export const botLocale = resolveLocale(env.botLocale);
export const messages = catalogs[botLocale];
