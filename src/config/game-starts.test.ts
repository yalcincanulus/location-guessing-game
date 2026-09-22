import { describe, expect, test } from "bun:test";
import { parseGameStartsEnabled } from "./game-starts.ts";

describe("parseGameStartsEnabled", () => {
  test("opens starts from on, aç, and enable", () => {
    expect(parseGameStartsEnabled("on")).toBe(true);
    expect(parseGameStartsEnabled("aç")).toBe(true);
    expect(parseGameStartsEnabled("enable")).toBe(true);
  });

  test("closes starts from off, kapat, and kapalı", () => {
    expect(parseGameStartsEnabled("off")).toBe(false);
    expect(parseGameStartsEnabled("kapat")).toBe(false);
    expect(parseGameStartsEnabled("kapalı")).toBe(false);
  });

  test("rejects an empty or unknown value", () => {
    expect(parseGameStartsEnabled("")).toBeUndefined();
    expect(parseGameStartsEnabled("maybe")).toBeUndefined();
  });
});
