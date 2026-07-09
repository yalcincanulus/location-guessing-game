import { describe, expect, test } from "bun:test";
import { isOfficiallyCovered } from "./official-coverage.ts";

describe("isOfficiallyCovered", () => {
  test("marks PlonkIt official coverage countries as in the game", () => {
    expect(isOfficiallyCovered("RE")).toBe(true);
    expect(isOfficiallyCovered("fr")).toBe(true);
    expect(isOfficiallyCovered("US")).toBe(true);
    expect(isOfficiallyCovered("JP")).toBe(true);
  });

  test("includes recent community additions missing from the PlonkIt dump", () => {
    expect(isOfficiallyCovered("GE")).toBe(true);
    expect(isOfficiallyCovered("BA")).toBe(true);
    expect(isOfficiallyCovered("PY")).toBe(true);
  });

  test("marks countries without official coverage as not in the game", () => {
    expect(isOfficiallyCovered("AF")).toBe(false);
    expect(isOfficiallyCovered("IR")).toBe(false);
    expect(isOfficiallyCovered("ZZ")).toBe(false);
  });
});
