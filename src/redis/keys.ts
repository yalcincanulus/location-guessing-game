export const keys = {
  activeGame: (guildId: string, channelId: string) => `game:active:${guildId}:${channelId}`,
  gameState: (gameId: string) => `game:${gameId}:state`,
  wrongCountries: (gameId: string) => `game:${gameId}:wrong-countries`,
  guessStreaks: (gameId: string) => `game:${gameId}:guess-streaks`,
  mapCache: (gameId: string, viewport: string, hash: string) =>
    `game:${gameId}:map-cache:${viewport}:${hash}`,
  pendingStart: (guildId: string, userId: string) => `pending-start:${guildId}:${userId}`,
  pendingScreenshot: (pendingKey: string) => `${pendingKey}:screenshot`,
  startReservation: (guildId: string, channelId: string) =>
    `start-reservation:${guildId}:${channelId}`,
};
