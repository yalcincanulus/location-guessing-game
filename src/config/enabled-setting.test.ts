import { describe, expect, test } from "bun:test";
import { parseEnabledSetting } from "./enabled-setting.ts";

describe("parseEnabledSetting", () => {
  test("enables a setting from on, aç, and enable", () => {
    expect(parseEnabledSetting("on")).toBe(true);
    expect(parseEnabledSetting("aç")).toBe(true);
    expect(parseEnabledSetting("enable")).toBe(true);
  });

  test("disables a setting from off, kapat, and kapalı", () => {
    expect(parseEnabledSetting("off")).toBe(false);
    expect(parseEnabledSetting("kapat")).toBe(false);
    expect(parseEnabledSetting("kapalı")).toBe(false);
  });

  test("rejects an empty or unknown value", () => {
    expect(parseEnabledSetting("")).toBeUndefined();
    expect(parseEnabledSetting("maybe")).toBeUndefined();
  });
});
