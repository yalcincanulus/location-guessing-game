import { describe, expect, test } from "bun:test";
import { idleReminderHour, istanbulDayKey } from "./schedule.ts";

describe("istanbulDayKey", () => {
  test("uses the Istanbul calendar date, not UTC", () => {
    // 2026-07-11 00:00 Istanbul
    expect(istanbulDayKey(new Date("2026-07-10T21:00:00.000Z"))).toBe("2026-07-11");
    // 2026-07-10 23:59 Istanbul
    expect(istanbulDayKey(new Date("2026-07-10T20:59:00.000Z"))).toBe("2026-07-10");
  });
});

describe("idleReminderHour", () => {
  test("returns the Istanbul hour only at configured reminder slots", () => {
    expect(idleReminderHour(new Date("2026-07-11T06:00:00.000Z"))).toBe(9);
    expect(idleReminderHour(new Date("2026-07-11T09:00:00.000Z"))).toBe(12);
    expect(idleReminderHour(new Date("2026-07-11T12:00:00.000Z"))).toBe(15);
    expect(idleReminderHour(new Date("2026-07-11T15:00:00.000Z"))).toBe(18);
    expect(idleReminderHour(new Date("2026-07-11T18:00:00.000Z"))).toBe(21);
  });

  test("returns null outside reminder hours", () => {
    expect(idleReminderHour(new Date("2026-07-11T05:00:00.000Z"))).toBeNull();
    expect(idleReminderHour(new Date("2026-07-11T21:00:00.000Z"))).toBeNull();
  });
});
