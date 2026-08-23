export const keys = {
  activeGame: (guildId: string, channelId: string) => `game:active:${guildId}:${channelId}`,
  gameState: (gameId: string) => `game:${gameId}:state`,
  wrongCountries: (gameId: string) => `game:${gameId}:wrong-countries`,
  guessStreaks: (gameId: string) => `game:${gameId}:guess-streaks`,
  winClaim: (gameId: string) => `game:${gameId}:win-claim`,
  mapCache: (gameId: string, viewport: string, hash: string) =>
    `game:${gameId}:map-cache:${viewport}:${hash}:jpg`,
  pendingStart: (guildId: string, userId: string) => `pending-start:${guildId}:${userId}`,
  pendingScreenshot: (pendingKey: string) => `${pendingKey}:screenshot`,
  startReservation: (guildId: string, channelId: string) =>
    `start-reservation:${guildId}:${channelId}`,
  feedbackRateLimit: (userId: string) => `feedback:rate-limit:${userId}`,
  dailyJob: (name: string, dayKey: string) => `job:once:${name}:${dayKey}`,
  idleReminderSlot: (dayKey: string, hour: number) => `job:once:idle-reminder:${dayKey}:${hour}`,
};
