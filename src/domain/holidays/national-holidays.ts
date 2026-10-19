/** Turkish national holidays whose images carry the Turkish flag. */
export type NationalHoliday = "childrensDay" | "youthDay" | "victoryDay" | "republicDay";

/** Month-day in Türkiye's calendar, for example "10-29". */
const NATIONAL_HOLIDAYS: Record<string, NationalHoliday> = {
  "04-23": "childrensDay",
  "05-19": "youthDay",
  "08-30": "victoryDay",
  "10-29": "republicDay",
};

const istanbulMonthDay = new Intl.DateTimeFormat("en-CA", {
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** The holiday on `date` in Türkiye, whatever the server's time zone. */
export const nationalHolidayOn = (date = new Date()): NationalHoliday | undefined => {
  const parts = istanbulMonthDay.formatToParts(date);
  const part = (type: "month" | "day") => parts.find((entry) => entry.type === type)?.value;
  return NATIONAL_HOLIDAYS[`${part("month")}-${part("day")}`];
};
