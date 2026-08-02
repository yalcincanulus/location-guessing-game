export const MAX_FEEDBACK_MESSAGES_PER_HOUR = 4;
export const FEEDBACK_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

/**
 * Atomically maintains a rolling one-hour window in a Redis sorted set.
 * Members are Discord message IDs and scores are Unix timestamps in seconds.
 */
export const FEEDBACK_RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local maximum = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count >= maximum then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = tonumber(oldest[2]) + window - now
  redis.call('EXPIRE', key, window)
  return { 0, math.max(1, retryAfter), count }
end

redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, window)
return { 1, 0, count + 1 }
`;

export type FeedbackRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  count: number;
};

export const parseFeedbackRateLimitResult = (result: unknown): FeedbackRateLimitDecision => {
  const values = Array.isArray(result) ? result : [];
  const value = (index: number) => Number(values[index] ?? 0);

  return {
    allowed: value(0) === 1,
    retryAfterSeconds: Math.max(0, value(1)),
    count: Math.max(0, value(2)),
  };
};
