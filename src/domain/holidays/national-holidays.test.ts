import { describe, expect, test } from "bun:test";
import { nationalHolidayOn } from "./national-holidays.ts";

describe("nationalHolidayOn", () => {
  test("finds each holiday", () => {
    expect(nationalHolidayOn(new Date("2027-04-23T12:00:00+03:00"))).toBe("childrensDay");
    expect(nationalHolidayOn(new Date("2027-05-19T12:00:00+03:00"))).toBe("youthDay");
    expect(nationalHolidayOn(new Date("2027-08-30T12:00:00+03:00"))).toBe("victoryDay");
    expect(nationalHolidayOn(new Date("2026-10-29T12:00:00+03:00"))).toBe("republicDay");
  });

  test("ignores ordinary days", () => {
    expect(nationalHolidayOn(new Date("2026-10-28T12:00:00+03:00"))).toBeUndefined();
    expect(nationalHolidayOn(new Date("2026-10-30T12:00:00+03:00"))).toBeUndefined();
  });

  test("follows the Istanbul calendar day, not UTC", () => {
    // 00:30 on 29 October in Istanbul is still 28 October in UTC.
    expect(nationalHolidayOn(new Date("2026-10-28T21:30:00Z"))).toBe("republicDay");
    // 23:59 on 29 October in Istanbul, then midnight.
    expect(nationalHolidayOn(new Date("2026-10-29T20:59:00Z"))).toBe("republicDay");
    expect(nationalHolidayOn(new Date("2026-10-29T21:00:00Z"))).toBeUndefined();
  });
});
