import { describe, expect, test } from "bun:test";
import type { GameRules } from "../../config/rules.ts";
import { canBypassGameMasterBlock } from "./test-mode.ts";

const baseRules: GameRules = {
  id: "rule",
  verifiedRoleName: "verified",
  commandPrefixes: ["!"],
  maxConsecutiveGuesses: 6,
  consecutiveGuessIdleResetSeconds: 1800,
  pendingStartTtlSeconds: 1800,
  startReservationSeconds: 60,
  baseWinPoints: 100,
  currentMultiplierMax: 2,
  gmMultiplierMax: 3,
  idleMultiplierIntervalSeconds: 900,
  idleMultiplierIncrement: 0.1,
  repeatGuessCountsForStats: true,
  repeatGuessCountsForGmDifficulty: false,
  queueGameStarts: false,
  gameStartsEnabled: true,
  testModeEnabled: true,
  testChannelId: "test-channel",
  testAdminUserIds: ["tester"],
};

describe("canBypassGameMasterBlock", () => {
  test("blocks normal games", () => {
    expect(canBypassGameMasterBlock({ isTest: false }, "test-channel", "tester", baseRules)).toBe(
      false,
    );
  });

  test("blocks test games when user is not a test admin", () => {
    expect(canBypassGameMasterBlock({ isTest: true }, "test-channel", "other", baseRules)).toBe(
      false,
    );
  });

  test("blocks test games outside the configured test channel", () => {
    expect(canBypassGameMasterBlock({ isTest: true }, "other-channel", "tester", baseRules)).toBe(
      false,
    );
  });

  test("blocks when test mode is disabled", () => {
    expect(
      canBypassGameMasterBlock({ isTest: true }, "test-channel", "tester", {
        ...baseRules,
        testModeEnabled: false,
      }),
    ).toBe(false);
  });

  test("allows test admin in configured test channel for test games", () => {
    expect(canBypassGameMasterBlock({ isTest: true }, "test-channel", "tester", baseRules)).toBe(
      true,
    );
  });
});
