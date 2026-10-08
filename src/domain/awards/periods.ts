export const AWARDS_TZ = "Europe/Istanbul";

export type PeriodType = "daily" | "weekly" | "monthly" | "seasonal" | "yearly";
export type AwardCategory = "points" | "wins" | "started" | "hardest";
export type Medal = "gold" | "silver" | "bronze";
export type SeasonName = "winter" | "spring" | "summer" | "fall";

export type PeriodWindow = {
  periodType: PeriodType;
  periodKey: string;
  startsAt: Date;
  endsAt: Date;
  label: string;
};

export type StandingRow = {
  playerId: string;
  displayName: string;
  discordUserId: string;
  value: number;
};

export type MedalAssignment = StandingRow & {
  medal: Medal;
  medalPoints: number;
};

export const MEDAL_POINTS: Record<Medal, number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
};

export const MEDAL_EMOJI: Record<Medal, string> = {
  gold: "🥇",
  silver: "🥈",
  bronze: "🥉",
};

export const AWARD_CATEGORIES: AwardCategory[] = ["points", "wins", "started", "hardest"];
export const PERIOD_TYPES: PeriodType[] = ["daily", "weekly", "monthly", "seasonal", "yearly"];

/** Periods rare enough that the profile card names each gold won in them. */
export type TitlePeriodType = Extract<PeriodType, "monthly" | "seasonal" | "yearly">;
export const TITLE_PERIOD_TYPES: TitlePeriodType[] = ["monthly", "seasonal", "yearly"];

/** One period a player took gold in, any category; `periodKey` as in `award_period`. */
export type GoldPeriod = { periodType: TitlePeriodType; periodKey: string };

/** Command words (normalized, English and Turkish) for each period type. */
export const PERIOD_ALIASES: Record<string, PeriodType> = {
  daily: "daily",
  gunluk: "daily",
  weekly: "weekly",
  haftalik: "weekly",
  monthly: "monthly",
  aylik: "monthly",
  seasonal: "seasonal",
  season: "seasonal",
  mevsim: "seasonal",
  mevsimlik: "seasonal",
  yearly: "yearly",
  year: "yearly",
  yillik: "yearly",
};

/** Command words (normalized) that ask for medals across all period types. */
export const ALL_TIME_ALIASES = new Set(["all", "alltime", "total", "tum", "tumu", "toplam"]);

const MEDAL_BY_TIER: Medal[] = ["gold", "silver", "bronze"];

type IstanbulParts = {
  year: number;
  month: number;
  day: number;
  weekday: number; // 0=Sun ... 6=Sat
};

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const getIstanbulParts = (date: Date): IstanbulParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AWARDS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekday = weekdayMap[lookup("weekday")];
  if (weekday === undefined) {
    throw new Error(`Could not parse Istanbul weekday for ${date.toISOString()}`);
  }

  return {
    year: Number(lookup("year")),
    month: Number(lookup("month")),
    day: Number(lookup("day")),
    weekday,
  };
};

/** Midnight Europe/Istanbul as a UTC Date (Istanbul is fixed UTC+3). */
export const istanbulMidnight = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day) - 3 * 60 * 60 * 1000);

const addDays = (year: number, month: number, day: number, delta: number) => {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
};

/** ISO week number (Mon-based) for a civil Istanbul date. */
export const isoWeekKey = (year: number, month: number, day: number): string => {
  const date = new Date(Date.UTC(year, month - 1, day));
  // Thursday in current week decides the year.
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  const weekYear = date.getUTCFullYear();
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
};

export const seasonForMonth = (month: number): SeasonName => {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
};

/** Season start month: winter=12, spring=3, summer=6, fall=9. */
const seasonStartMonth = (season: SeasonName): number => {
  switch (season) {
    case "winter":
      return 12;
    case "spring":
      return 3;
    case "summer":
      return 6;
    case "fall":
      return 9;
  }
};

/**
 * Calendar year used in the period key for a season containing (year, month).
 * Winter Dec Y / Jan–Feb Y+1 is keyed as `${Y}-winter` using December's year.
 */
export const seasonKeyForDate = (year: number, month: number): string => {
  const season = seasonForMonth(month);
  if (season === "winter" && month <= 2) {
    return `${year - 1}-winter`;
  }
  return `${year}-${season}`;
};

const currentSeasonWindow = (year: number, month: number): PeriodWindow => {
  const season = seasonForMonth(month);
  const key = seasonKeyForDate(year, month);
  const startMonth = seasonStartMonth(season);
  const startYear = season === "winter" && month <= 2 ? year - 1 : year;
  const endMonth = startMonth === 12 ? 3 : startMonth + 3;
  const endYear = startMonth === 12 ? startYear + 1 : startYear;
  return {
    periodType: "seasonal",
    periodKey: key,
    startsAt: istanbulMidnight(startYear, startMonth, 1),
    endsAt: istanbulMidnight(endYear, endMonth, 1),
    label: key,
  };
};

const previousSeasonWindow = (year: number, month: number): PeriodWindow => {
  // At season boundary (1st of Mar/Jun/Sep/Dec), previous season just ended.
  const boundaryMonth = month;
  if (boundaryMonth === 3) {
    return {
      periodType: "seasonal",
      periodKey: `${year - 1}-winter`,
      startsAt: istanbulMidnight(year - 1, 12, 1),
      endsAt: istanbulMidnight(year, 3, 1),
      label: `${year - 1}-winter`,
    };
  }
  if (boundaryMonth === 6) {
    return {
      periodType: "seasonal",
      periodKey: `${year}-spring`,
      startsAt: istanbulMidnight(year, 3, 1),
      endsAt: istanbulMidnight(year, 6, 1),
      label: `${year}-spring`,
    };
  }
  if (boundaryMonth === 9) {
    return {
      periodType: "seasonal",
      periodKey: `${year}-summer`,
      startsAt: istanbulMidnight(year, 6, 1),
      endsAt: istanbulMidnight(year, 9, 1),
      label: `${year}-summer`,
    };
  }
  // December 1 → previous fall
  return {
    periodType: "seasonal",
    periodKey: `${year}-fall`,
    startsAt: istanbulMidnight(year, 9, 1),
    endsAt: istanbulMidnight(year, 12, 1),
    label: `${year}-fall`,
  };
};

/** Current (in-progress) period window ending at "now" for live standings. */
export const getCurrentPeriodWindow = (
  periodType: PeriodType,
  now: Date = new Date(),
): PeriodWindow => {
  const { year, month, day, weekday } = getIstanbulParts(now);
  const endsAt = now;

  switch (periodType) {
    case "daily": {
      const startsAt = istanbulMidnight(year, month, day);
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { periodType, periodKey: key, startsAt, endsAt, label: key };
    }
    case "weekly": {
      const daysFromMonday = (weekday + 6) % 7;
      const monday = addDays(year, month, day, -daysFromMonday);
      const startsAt = istanbulMidnight(monday.year, monday.month, monday.day);
      const key = isoWeekKey(monday.year, monday.month, monday.day);
      return { periodType, periodKey: key, startsAt, endsAt, label: key };
    }
    case "monthly": {
      const startsAt = istanbulMidnight(year, month, 1);
      const key = `${year}-${String(month).padStart(2, "0")}`;
      return { periodType, periodKey: key, startsAt, endsAt, label: key };
    }
    case "seasonal":
      return { ...currentSeasonWindow(year, month), endsAt };
    case "yearly": {
      const startsAt = istanbulMidnight(year, 1, 1);
      const key = String(year);
      return { periodType, periodKey: key, startsAt, endsAt, label: key };
    }
  }
};

/** Just-closed period window relative to `now` (typically midnight boundary). */
export const getPreviousPeriodWindow = (
  periodType: PeriodType,
  now: Date = new Date(),
): PeriodWindow => {
  const { year, month, day, weekday } = getIstanbulParts(now);

  switch (periodType) {
    case "daily": {
      const prev = addDays(year, month, day, -1);
      const startsAt = istanbulMidnight(prev.year, prev.month, prev.day);
      const endsAt = istanbulMidnight(year, month, day);
      const key = `${prev.year}-${String(prev.month).padStart(2, "0")}-${String(prev.day).padStart(2, "0")}`;
      return { periodType, periodKey: key, startsAt, endsAt, label: key };
    }
    case "weekly": {
      // Previous Mon–Mon week ending at this Monday 00:00.
      const daysFromMonday = (weekday + 6) % 7;
      const thisMonday = addDays(year, month, day, -daysFromMonday);
      const prevMonday = addDays(thisMonday.year, thisMonday.month, thisMonday.day, -7);
      const startsAt = istanbulMidnight(prevMonday.year, prevMonday.month, prevMonday.day);
      const endsAt = istanbulMidnight(thisMonday.year, thisMonday.month, thisMonday.day);
      const key = isoWeekKey(prevMonday.year, prevMonday.month, prevMonday.day);
      return { periodType, periodKey: key, startsAt, endsAt, label: key };
    }
    case "monthly": {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const startsAt = istanbulMidnight(prevYear, prevMonth, 1);
      const endsAt = istanbulMidnight(year, month, 1);
      const key = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
      return { periodType, periodKey: key, startsAt, endsAt, label: key };
    }
    case "seasonal":
      return previousSeasonWindow(year, month);
    case "yearly": {
      const startsAt = istanbulMidnight(year - 1, 1, 1);
      const endsAt = istanbulMidnight(year, 1, 1);
      const key = String(year - 1);
      return { periodType, periodKey: key, startsAt, endsAt, label: key };
    }
  }
};

export const periodsToFinalize = (now: Date = new Date()): PeriodType[] => {
  const { month, day, weekday } = getIstanbulParts(now);
  const types: PeriodType[] = ["daily"];

  // Monday (weekday 1)
  if (weekday === 1) {
    types.push("weekly");
  }
  if (day === 1) {
    types.push("monthly");
  }
  if (day === 1 && (month === 3 || month === 6 || month === 9 || month === 12)) {
    types.push("seasonal");
  }
  if (day === 1 && month === 1) {
    types.push("yearly");
  }

  return types;
};

/** Dense-rank top 3 score tiers → gold / silver / bronze. */
export const assignMedals = (rows: StandingRow[]): MedalAssignment[] => {
  const awards: MedalAssignment[] = [];
  let tierIndex = 0;
  let lastValue: number | null = null;

  for (const row of rows) {
    if (lastValue === null) {
      lastValue = row.value;
    } else if (row.value !== lastValue) {
      tierIndex += 1;
      lastValue = row.value;
    }

    if (tierIndex >= MEDAL_BY_TIER.length) {
      break;
    }

    const medal = MEDAL_BY_TIER[tierIndex]!;
    awards.push({
      ...row,
      medal,
      medalPoints: MEDAL_POINTS[medal],
    });
  }

  return awards;
};
