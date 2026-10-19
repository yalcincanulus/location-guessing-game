/** Turkish national holidays whose images carry the Turkish flag. */
export type NationalHoliday = "childrensDay" | "youthDay" | "victoryDay" | "republicDay";

/** Month-day in Türkiye's calendar, for example "10-29". */
const NATIONAL_HOLIDAYS: Record<string, NationalHoliday> = {
  "04-23": "childrensDay",
  "05-19": "youthDay",
  "08-30": "victoryDay",
  "10-29": "republicDay",
};

/** 10 November, the anniversary of Atatürk's death: images go black and white. */
const ATATURK_MEMORIAL_DAY = "11-10";

const istanbulMonthDay = new Intl.DateTimeFormat("en-CA", {
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** "MM-DD" of `date` in Türkiye, whatever the server's time zone. */
const monthDayInTurkey = (date: Date) => {
  const parts = istanbulMonthDay.formatToParts(date);
  const part = (type: "month" | "day") => parts.find((entry) => entry.type === type)?.value;
  return `${part("month")}-${part("day")}`;
};

/** The holiday on `date` in Türkiye. */
export const nationalHolidayOn = (date = new Date()): NationalHoliday | undefined =>
  NATIONAL_HOLIDAYS[monthDayInTurkey(date)];

/** How the day changes the images: the flag on holidays, black and white on 10 November. */
export type ImageOccasion = {
  holiday?: NationalHoliday;
  mourning?: boolean;
};

export const imageOccasionOn = (date = new Date()): ImageOccasion => {
  const monthDay = monthDayInTurkey(date);
  const holiday = NATIONAL_HOLIDAYS[monthDay];
  if (holiday) return { holiday };
  if (monthDay === ATATURK_MEMORIAL_DAY) return { mourning: true };
  return {};
};
