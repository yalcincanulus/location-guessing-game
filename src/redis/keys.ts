export const keys = {
  activeGame: (guildId: string, channelId: string) => `game:active:${guildId}:${channelId}`,
  gameState: (gameId: string) => `game:${gameId}:state`,
  /** Wrong target codes: country codes, or plate codes in province games. */
  wrongCountries: (gameId: string) => `game:${gameId}:wrong-countries`,
  guessStreaks: (gameId: string) => `game:${gameId}:guess-streaks`,
  winClaim: (gameId: string) => `game:${gameId}:win-claim`,
  mapCache: (gameId: string, viewport: string, hash: string) =>
    `game:${gameId}:map-cache:${viewport}:${hash}:jpg`,
  /** Country starts keep the original key. Province starts get their own suffix. */
  pendingStart: (guildId: string, userId: string, mode: "country" | "province" = "country") =>
    mode === "province"
      ? `pending-start:${guildId}:${userId}:province`
      : `pending-start:${guildId}:${userId}`,
  pendingScreenshot: (pendingKey: string) => `${pendingKey}:screenshot`,
  /** DM start that waits for the player to pick country or province mode. */
  startModeChoice: (userId: string) => `start-mode-choice:${userId}`,
  startModeChoiceScreenshot: (userId: string) => `start-mode-choice:${userId}:screenshot`,
  startReservation: (guildId: string, channelId: string) =>
    `start-reservation:${guildId}:${channelId}`,
  feedbackRateLimit: (userId: string) => `feedback:rate-limit:${userId}`,
  dailyJob: (name: string, dayKey: string) => `job:once:${name}:${dayKey}`,
  idleReminderSlot: (dayKey: string, hour: number) => `job:once:idle-reminder:${dayKey}:${hour}`,
};
