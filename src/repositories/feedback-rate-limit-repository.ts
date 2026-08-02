import {
  FEEDBACK_RATE_LIMIT_SCRIPT,
  FEEDBACK_RATE_LIMIT_WINDOW_SECONDS,
  MAX_FEEDBACK_MESSAGES_PER_HOUR,
  parseFeedbackRateLimitResult,
} from "../domain/feedback-rate-limit.ts";
import { redis } from "../redis/client.ts";
import { keys } from "../redis/keys.ts";

export const consumeFeedbackRateLimit = async (
  userId: string,
  discordMessageId: string,
  now = Date.now(),
) => {
  const result = await redis.eval(
    FEEDBACK_RATE_LIMIT_SCRIPT,
    1,
    keys.feedbackRateLimit(userId),
    Math.floor(now / 1000),
    FEEDBACK_RATE_LIMIT_WINDOW_SECONDS,
    MAX_FEEDBACK_MESSAGES_PER_HOUR,
    discordMessageId,
  );

  return parseFeedbackRateLimitResult(result);
};

export const clearFeedbackRateLimit = async (userId: string) => {
  await redis.del(keys.feedbackRateLimit(userId));
};
