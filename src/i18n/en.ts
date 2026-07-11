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
    location: "Location",
  },
  start: {
    gameChannelNotConfigured: "Game channel is not configured.",
    configuredGameChannelUnavailable: "Configured game channel is not available.",
    activeGameAlreadyExists: "There is already an active game.",
    couldNotExtractCoordinates: "I could not extract coordinates from that Google Maps link.",
    gameStarted: (userId, { inTheGame, coverageSource }) => {
      const coverageLine =
        coverageSource === "google"
          ? "**Coverage:** Official Google Street View"
          : coverageSource === "third-party"
            ? "**Coverage:** Third-party / photosphere"
            : "**Coverage:** Unknown (could not tell from the link)";

      return [
        `<@${userId}> started a new location game. Guess the country by typing its name or ISO code.`,
        inTheGame
          ? "**In the game:** Yes — this country has official coverage in GeoGuessr."
          : "**In the game:** No — this country is not in the official GeoGuessr coverage set.",
        coverageLine,
      ].join("\n");
    },
    needsVerifiedRole: "You need the verified role to start games.",
    startingWaitingForScreenshot: (userId) =>
      `<@${userId}> is starting a new game. Waiting for screenshot.`,
    startingWaitingForLink: (userId) =>
      `<@${userId}> is starting a new game. Waiting for Google Maps link.`,
    startReservationExpired: (userId, missing) =>
      missing === "screenshot"
        ? `<@${userId}> failed to add a screenshot in time. A new game can be started.`
        : `<@${userId}> failed to add a Google Maps link in time. A new game can be started.`,
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
      "Commands: `!map`, `!harita`, `!europe`, `!ss`, `!profile`, `!leaderboard`, `!stats`, `!daily`, `!weekly`, `!monthly`, `!seasonal`, `!yearly`, `!medals`.",
    helpTestCommands:
      "Test: `!test status`, `!test cancel`, `!test reveal`, `!test tick`, `!test reset`, `!test map`.",
  },
  awards: {
    liveHeader: (periodType, periodKey) => {
      const labels = {
        daily: "Daily",
        weekly: "Weekly",
        monthly: "Monthly",
        seasonal: "Seasonal",
        yearly: "Yearly",
      } as const;
      return `**${labels[periodType]} standings** (${periodKey})`;
    },
    resultsHeader: (periodType, periodKey) => {
      const labels = {
        daily: "Daily",
        weekly: "Weekly",
        monthly: "Monthly",
        seasonal: "Seasonal",
        yearly: "Yearly",
      } as const;
      return `**${labels[periodType]} awards** (${periodKey})`;
    },
    categoryTitle: (category) => {
      const labels = {
        points: "Most Points",
        wins: "Most Wins",
        started: "Most Games Started",
        hardest: "Best Game Master",
      } as const;
      return `**${labels[category]}**`;
    },
    standingRow: (rank, displayName, value, medalEmoji) =>
      medalEmoji
        ? `${medalEmoji} ${rank}. ${displayName}: **${value}**`
        : `${rank}. ${displayName}: **${value}**`,
    noCategoryData: "_No data yet._",
    noMedalData: "No medals awarded yet.",
    medalRow: ({ rank, displayName, medalPoints, gold, silver, bronze }) =>
      `${rank}. ${displayName}: **${medalPoints}** pts (🥇${gold} 🥈${silver} 🥉${bronze})`,
    medalsHeader: "**Medal rankings**",
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
  admin: {
    help: [
      "Admin commands (DM only):",
      "`!admin help` — this list",
      "`!admin status` — active game / Redis-DB drift",
      "`!admin cancel [reason]` — cancel the active game",
      "`!admin reveal` — show answer + coordinates",
      "`!admin clear-start` — clear stuck start reservation",
      "`!admin reload` — refresh rules from the database",
      "`!admin tick` — force idle multiplier increase",
      "`!admin awards [daily|weekly|monthly|seasonal|yearly]` — finalize & announce previous period (default: daily)",
    ].join("\n"),
    gameChannelNotConfigured: "Game channel is not configured.",
    gameChannelUnavailable: "Configured game channel is not available.",
    noActiveGame: "No active game in the game channel.",
    cancelledGame: (gameId) => `Cancelled game ${gameId}.`,
    cancelledAnnouncement: (gameId, reason) =>
      `This game was cancelled by an admin (${gameId}). Reason: ${reason}`,
    status: ({ game, wrongCountryCount, currentMultiplier, isTestGame, redisMissingButDbActive }) =>
      [
        "Admin status",
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
    clearStartDone: "Cleared start reservation and pending start for the game channel.",
    noStartState: "No start reservation to clear in the game channel.",
    rulesReloaded: "Rules cache reloaded from the database.",
    multiplierCapped: (currentMultiplier) =>
      `Current multiplier is already capped at ${currentMultiplier.toFixed(2)}x.`,
    forcedMultiplierTick: (previousMultiplier, newMultiplier) =>
      `Forced multiplier tick: ${previousMultiplier.toFixed(2)}x -> ${newMultiplier.toFixed(2)}x.`,
    multiplierNoChange: "Multiplier tick did not change the active game.",
    awardsFinalized: (periodType, periodKey, medalCount) =>
      `Finalized **${periodType}** awards for **${periodKey}** (${medalCount} medals) and announced in the game channel.`,
    awardsAlreadyAnnounced: (periodType, periodKey) =>
      `**${periodType}** awards for **${periodKey}** were already calculated and announced.`,
    awardsAnnounceFailed: (periodType, periodKey) =>
      `Calculated **${periodType}** awards for **${periodKey}**, but posting to the game channel failed. Awards are saved; re-run after fixing the channel.`,
    awardsInvalidPeriod:
      "Unknown period. Use `daily`, `weekly`, `monthly`, `seasonal`, or `yearly` (default: `daily`).",
    unknownCommand:
      "Unknown admin command. Use `!admin help`, `status`, `cancel`, `reveal`, `clear-start`, `reload`, `tick`, or `awards`.",
  },
  game: {
    foundCountry: (userId, countryName) => `<@${userId}> found the country: **${countryName}**.`,
    locationDetails: ({ regionName, googleMapsUrl, latitude, longitude }) =>
      [
        regionName ? `Region: **${regionName}**` : undefined,
        `Coordinates: **${latitude.toFixed(5)}, ${longitude.toFixed(5)}**`,
        `Maps: ${googleMapsUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    testNoPoints: "Test game: no points awarded.",
    reward: (points, basePoints, currentMultiplier, gmMultiplier) =>
      `Reward: **${points}** points (${basePoints} x ${currentMultiplier.toFixed(2)} x ${gmMultiplier.toFixed(2)}).`,
    osmAttribution:
      "Location data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.",
  },
  jobs: {
    multiplierIncreased: (currentMultiplier) =>
      `Current multiplier increased to **${currentMultiplier.toFixed(2)}x**.`,
    channelIdleReminder:
      "No game has started in the last hour. Start one by posting a **Google Maps link** and a **screenshot** in this channel, or by DMing the bot.",
  },
} satisfies BotMessages;
