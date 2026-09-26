import { describe, expect, test } from "bun:test";
import type { GameRules } from "../../config/rules.ts";
import { modeForChannel, parseModeToken, takeModeArg } from "./game-mode.ts";

const rules = (overrides: Partial<GameRules>) =>
  ({ gameChannelId: "country", provinceGameChannelId: "province", ...overrides }) as GameRules;

describe("modeForChannel", () => {
  test("maps each configured channel to its mode", () => {
    expect(modeForChannel(rules({}), "country")).toBe("country");
    expect(modeForChannel(rules({}), "province")).toBe("province");
    expect(modeForChannel(rules({}), "general")).toBeUndefined();
  });

  test("keeps every channel on country mode when no country channel is set", () => {
    expect(modeForChannel(rules({ gameChannelId: undefined }), "general")).toBe("country");
    expect(modeForChannel(rules({ gameChannelId: undefined }), "province")).toBe("province");
  });

  test("plays province games in the province test channel only while test mode is on", () => {
    const withTest = { provinceTestChannelId: "province-test", testModeEnabled: true };
    expect(modeForChannel(rules(withTest), "province-test")).toBe("province");
    expect(
      modeForChannel(rules({ ...withTest, testModeEnabled: false }), "province-test"),
    ).toBeUndefined();
  });

  test("has no province channel until one is configured", () => {
    expect(modeForChannel(rules({ provinceGameChannelId: undefined }), "province")).toBeUndefined();
  });
});

describe("mode words", () => {
  test("parses Turkish and English mode words", () => {
    expect(parseModeToken("il")).toBe("province");
    expect(parseModeToken("İL")).toBe("province");
    expect(parseModeToken("Türkiye")).toBe("province");
    expect(parseModeToken("ülke")).toBe("country");
    expect(parseModeToken("wins")).toBeUndefined();
  });

  test("takes the mode word out of command args", () => {
    expect(takeModeArg(["il", "wins"])).toEqual({ mode: "province", rest: ["wins"] });
    expect(takeModeArg(["daily", "province"])).toEqual({ mode: "province", rest: ["daily"] });
    expect(takeModeArg(["wins"])).toEqual({ rest: ["wins"] });
  });
});
