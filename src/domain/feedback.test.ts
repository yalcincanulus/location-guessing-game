import { describe, expect, test } from "bun:test";
import {
  FEEDBACK_RATE_LIMIT_WINDOW_SECONDS,
  MAX_FEEDBACK_MESSAGES_PER_HOUR,
  parseFeedbackRateLimitResult,
} from "./feedback-rate-limit.ts";
import { parseFeedbackCommand, truncateFeedback } from "./feedback.ts";

describe("parseFeedbackCommand", () => {
  test("extracts the complete feedback text from a DM command", () => {
    expect(
      parseFeedbackCommand("!feedback The map was great\nPlease add more rounds.", ["!"]),
    ).toEqual({ message: "The map was great\nPlease add more rounds." });
  });

  test("accepts Turkish feedback alias and rejects other commands", () => {
    expect(parseFeedbackCommand("!geribildirim Harika oyun", ["!"])).toEqual({
      message: "Harika oyun",
    });
    expect(parseFeedbackCommand("!profile", ["!"])).toBeUndefined();
  });

  test("supports configured prefixes and empty feedback", () => {
    expect(parseFeedbackCommand("?feedback", ["!"])).toBeUndefined();
    expect(parseFeedbackCommand("?feedback", ["?", "!"])).toEqual({ message: "" });
  });
});

describe("truncateFeedback", () => {
  test("keeps short messages and adds an ellipsis to long ones", () => {
    expect(truncateFeedback("short", 10)).toBe("short");
    expect(truncateFeedback("1234567890", 5)).toBe("1234…");
  });
});

describe("feedback rate limit", () => {
  test("allows four messages and returns retry information when blocked", () => {
    expect(MAX_FEEDBACK_MESSAGES_PER_HOUR).toBe(4);
    expect(FEEDBACK_RATE_LIMIT_WINDOW_SECONDS).toBe(3_600);
    expect(parseFeedbackRateLimitResult([1, 0, 4])).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
      count: 4,
    });
    expect(parseFeedbackRateLimitResult([0, "120", "4"])).toEqual({
      allowed: false,
      retryAfterSeconds: 120,
      count: 4,
    });
  });
});
