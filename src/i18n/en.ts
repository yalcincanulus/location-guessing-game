import type { BotMessages } from "./types.ts";

export const enMessages = {
  locale: "en",
  filenames: {
    fallbackScreenshot: "screenshot.png",
    worldGuesses: "world-guesses.png",
  },
  mapLegend: {
    wrongGuesses: "Wrong guesses",
    correct: "Correct",
  },
  start: {
    gameChannelNotConfigured: "Game channel is not configured.",
    configuredGameChannelUnavailable: "Configured game channel is not available.",
    activeGameAlreadyExists: "There is already an active game.",
    couldNotExtractCoordinates: "I could not extract coordinates from that Google Maps link.",
    gameStarted: (userId) =>
      `<@${userId}> started a new location game. Guess the country by typing its name or ISO code.`,
    needsVerifiedRole: "You need the verified role to start games.",
    nowSendScreenshot: "Got it. Now send the screenshot to start the game.",
    nowSendGoogleMapsLink: "Got it. Now send the Google Maps link to start the game.",
    sendLinkAndScreenshot: "Send a Google Maps link and a screenshot to start the game.",
  },
  commands: {
    noActiveGameInChannel: "No active game in this channel.",
    couldNotLoadScreenshot: "I could not load the current screenshot.",
    noProfileYet: "No profile yet.",
    profile: ({
      displayName,
      points,
      wins,
      participated,
      winRate,
      gamesStarted,
      guesses,
      gmMultiplier,
    }) =>
      [
        `**${displayName}**`,
        `Points: **${points}**`,
        `Wins: **${wins}** / Participated: **${participated}** (${winRate}%)`,
        `Games started: **${gamesStarted}**`,
        `Guesses: **${guesses}**`,
        `GM multiplier: **${gmMultiplier.toFixed(2)}x**`,
      ].join("\n"),
    leaderboardRow: (rank, displayName, value) => `${rank}. ${displayName}: **${value}**`,
    noLeaderboardData: "No leaderboard data yet.",
    stats: ({ completedGames, totalGames, totalGuesses }) =>
      [
        `Games: **${completedGames}** completed / **${totalGames}** total`,
        `Total guesses: **${totalGuesses}**`,
      ].join("\n"),
    helpCommands:
      "Commands: `!map`, `!harita`, `!europe`, `!ss`, `!profile`, `!leaderboard`, `!stats`.",
    helpTestCommands:
      "Test: `!test status`, `!test cancel`, `!test reveal`, `!test tick`, `!test reset`, `!test map`.",
  },
  test: {
    modeDisabled: "Test mode is disabled.",
    onlyInTestChannel: "Test utilities are only available in the configured test channel.",
    notEnabledForUser: "Test utilities are not enabled for you in this channel.",
    noActiveGameInTestChannel: "No active game in this test channel.",
    cancelledGame: (gameId) => `Cancelled test game ${gameId}.`,
    resetGameState: "Reset test game state.",
    status: ({ game, wrongCountryCount, currentMultiplier, isTestGame, redisMissingButDbActive }) =>
      [
        "Test mode: **enabled**",
        "Test channel: **yes**",
        "Caller admin: **yes**",
        game ? `Game: **${game.id}** (${game.status})` : "Game: **none**",
        game ? `Game master: <@${game.gameMasterDiscordUserId}>` : undefined,
        `Wrong countries: **${wrongCountryCount}**`,
        `Current multiplier: **${currentMultiplier.toFixed(2)}x**`,
        `Test game: **${isTestGame}**`,
        redisMissingButDbActive
          ? "Redis active state is missing, but an active database game exists."
          : undefined,
        game ? `Target: **${game.target}**` : undefined,
        game?.regionName ? `Region: **${game.regionName}**` : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    redisMissingButDbActive: "Redis active state is missing, but an active database game exists.",
    reveal: ({ redisMissingButDbActive, answer, regionName, latitude, longitude }) =>
      [
        redisMissingButDbActive
          ? "Redis active state is missing, but an active database game exists."
          : undefined,
        `Answer: **${answer}**`,
        regionName ? `Region: **${regionName}**` : undefined,
        `Coordinates: **${latitude.toFixed(5)}, ${longitude.toFixed(5)}**`,
      ]
        .filter(Boolean)
        .join("\n"),
    multiplierCapped: (currentMultiplier) =>
      `Current multiplier is already capped at ${currentMultiplier.toFixed(2)}x.`,
    forcedMultiplierTick: (previousMultiplier, newMultiplier) =>
      `Forced multiplier tick: ${previousMultiplier.toFixed(2)}x -> ${newMultiplier.toFixed(2)}x.`,
    multiplierNoChange: "Multiplier tick did not change the active game.",
    sampleMap: (correctCountry, wrongCountries) =>
      [
        "Sample map render:",
        `Correct: **${correctCountry}**`,
        `Wrong: **${wrongCountries.join(", ")}**`,
      ].join("\n"),
    unknownCommand:
      "Unknown test command. Use `!test status`, `cancel`, `reveal`, `tick`, `reset`, or `map`.",
  },
  game: {
    foundCountry: (userId, countryName) => `<@${userId}> found the country: **${countryName}**.`,
    testNoPoints: "Test game: no points awarded.",
    reward: (points, basePoints, currentMultiplier, gmMultiplier) =>
      `Reward: **${points}** points (${basePoints} x ${currentMultiplier.toFixed(2)} x ${gmMultiplier.toFixed(2)}).`,
    osmAttribution:
      "Location data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.",
  },
  jobs: {
    multiplierIncreased: (currentMultiplier) =>
      `Current multiplier increased to **${currentMultiplier.toFixed(2)}x**.`,
  },
} satisfies BotMessages;
