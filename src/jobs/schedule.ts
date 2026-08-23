import { getIstanbulParts } from "../domain/awards/periods.ts";

/** How often cron-like queues poll. Work is gated separately so a tight loop cannot re-run. */
export const SCHEDULER_POLL_MS = 60_000;
export const ONCE_TTL_SECONDS = 48 * 60 * 60;
export const IDLE_REMINDER_HOURS = [9, 12, 15, 18, 21] as const;
export const IDLE_REMINDER_TZ = "Europe/Istanbul";

export const istanbulDayKey = (now = new Date()): string => {
  const { year, month, day } = getIstanbulParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const idleReminderHour = (now = new Date()): number | null => {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: IDLE_REMINDER_TZ,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  return (IDLE_REMINDER_HOURS as readonly number[]).includes(hour) ? hour : null;
};
