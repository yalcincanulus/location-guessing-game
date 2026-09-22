import type { BotMessages } from "./types.ts";
import {
  achievementDescriptionsEn,
  achievementNamesEn,
  formatAchievementTier,
} from "./achievement-copy.ts";

export const enMessages = {
  locale: "en",
  filenames: {
    fallbackScreenshot: "screenshot.png",
    worldGuesses: "world-guesses.jpg",
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
    untrustedLocation:
      "I could not safely start this game. Nominatim cannot reliably identify locations in the Falkland Islands or South Georgia and the South Sandwich Islands, so the game was cancelled before it started. Please choose a different location.",
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
    screenshotTooLarge: (userId, maxMb) =>
      `<@${userId}> that screenshot could not be compressed under Discord's **${maxMb} MB** upload limit. Please send a smaller image to start the game.`,
    startsClosed: (userId) =>
      `<@${userId}> new game starts are closed. A game already in progress keeps running.`,
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
      medalPoints,
      gold,
      silver,
      bronze,
      achievementsUnlocked,
    }) =>
      [
        `**${displayName}**`,
        `Points: **${points}**`,
        `Wins: **${wins}** / Participated: **${participated}** (${winRate}%)`,
        `Games started: **${gamesStarted}**`,
        `Guesses: **${guesses}**`,
        `GM multiplier: **${gmMultiplier.toFixed(2)}x**`,
        `Medals: 🥇**${gold}** 🥈**${silver}** 🥉**${bronze}** (**${medalPoints}** pts)`,
        `Achievements: **${achievementsUnlocked}** unlocked`,
      ].join("\n"),
    leaderboardRow: (rank, displayName, value) => `${rank}. ${displayName}: **${value}**`,
    noLeaderboardData: "No leaderboard data yet.",
    stats: ({ completedGames, totalGames, totalGuesses }) =>
      [
        `Games: **${completedGames}** completed / **${totalGames}** total`,
        `Total guesses: **${totalGuesses}**`,
      ].join("\n"),
    helpCommands:
      "Commands: `!map`, `!harita`, `!europe`, `!ss`, `!profile`, `!leaderboard`, `!stats`, `!daily`, `!weekly`, `!monthly`, `!seasonal`, `!yearly`, `!medals <period>`, `!achievements` (also works in DM), `!feedback <message>` (DM only).",
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
    noMedalData: "No medals awarded yet for that period.",
    medalsUsage:
      "Usage: `!medals <period>` — period is `daily`, `weekly`, `monthly`, `seasonal`, or `yearly`.",
    medalRow: ({ rank, displayName, medalPoints, gold, silver, bronze }) =>
      `${rank}. ${displayName}: **${medalPoints}** pts (🥇${gold} 🥈${silver} 🥉${bronze})`,
    medalsHeader: (periodType) => {
      const labels = {
        daily: "Daily",
        weekly: "Weekly",
        monthly: "Monthly",
        seasonal: "Seasonal",
        yearly: "Yearly",
      } as const;
      return `**${labels[periodType]} medal rankings**`;
    },
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
      "`!admin achievements backfill` — recompute achievements for all players (silent)",
      "`!admin feedback [limit]` — view recent player feedback (default: 20, max: 50)",
      "`!admin feedback <id>` — view one feedback message in full",
      "`!admin feedback clear <username>` — clear that player's feedback rate limit",
      "`!admin clear-guesses` — reset consecutive guess streaks so players can guess again",
      "`!admin max-guesses [n]` — show or set max consecutive guesses (1–100, immediate)",
      "`!admin starts [on|off]` — open or close new game starts. A game already running keeps going",
      "`!admin suspects [minGames]` — review pairs and host-only accounts (default 5, DM)",
      "`!admin pair <player> <player>` — games between two players (DM)",
      "`!admin player <player>` — win rate, first-guess accuracy, hosts (DM)",
      "`!admin game <id>` — guess timeline for one game (DM)",
      "`!admin fast <seconds>` — wins at or under this solve time (DM)",
      "`!admin dismiss pair <player> <player>` — hide that pair from the review list (DM)",
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
    guessesCleared:
      "Cleared consecutive guess streaks for the active game. Players can guess again.",
    maxGuessesCurrent: (current) =>
      `Max consecutive guesses is **${current}**. Use \`!admin max-guesses <n>\` to change it.`,
    maxGuessesUpdated: (previous, next) =>
      `Max consecutive guesses: **${previous}** → **${next}**. Active game uses this immediately.`,
    maxGuessesUsage: (current, min, max) =>
      `Usage: \`!admin max-guesses <n>\` with an integer from **${min}** to **${max}**. Current: **${current}**.`,
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
    achievementsBackfillDone: (players, unlocks, errors) =>
      `Achievements backfill complete: **${players}** players, **${unlocks}** unlocks inserted, **${errors}** errors.`,
    reviewSentToDm: "Review sent to your DMs.",
    reviewDmFailed: "I couldn't open a DM. Send the command in a DM with the bot.",
    reviewEmpty: "Nothing to report.",
    suspectsUsage:
      "Usage: `!admin suspects [minGames]` — integer from **1** to **100**. Default: **5**.",
    suspectsHeader: (minGames, shownPairs, pairCount, shownHosts, hostCount) =>
      [
        `Review list. Minimum shared games: **${minGames}**.`,
        `Pairs: **${shownPairs}** of **${pairCount}**. Host-only accounts: **${shownHosts}** of **${hostCount}**.`,
        "Each line is one direction. The left name is the host, the right name won that host's games. The reverse appears on its own line when it also passes.",
        "A cleared pair stays off this list.",
      ].join("\n"),
    suspectsNoPairs: "No pair is above the threshold.",
    suspectsHostHeader: "Host-only accounts",
    suspectsNoHosts: "No host-only account is above the threshold.",
    suspectPairLine: ({
      gmName,
      gmDiscordUserId,
      playerName,
      playerDiscordUserId,
      winsWith,
      playedWith,
      elsewhere,
      silentWins,
      fastWins,
      medianSolve,
    }) =>
      `Host **${gmName}** (\`${gmDiscordUserId}\`) → winner **${playerName}** (\`${playerDiscordUserId}\`). Winner took **${winsWith}/${playedWith}** of this host's games, ${elsewhere}. Silent **${silentWins}/${winsWith}**, fast **${fastWins}/${winsWith}**. Median solve **${medianSolve}**.`,
    suspectHostLine: ({
      name,
      discordUserId,
      started,
      participated,
      won,
      created,
      winnerName,
      winnerDiscordUserId,
      topWins,
      completed,
    }) =>
      `**${name}** (\`${discordUserId}\`) started **${started}**, played **${participated}**, won **${won}**. Account created ${created}. Top winner **${winnerName}** (\`${winnerDiscordUserId}\`) ${topWins}/${completed}.`,
    reviewElsewhereNone: "no games with other hosts",
    reviewElsewhereZero: (played) => `0/${played} with other hosts`,
    reviewElsewhere: (wins, played, lift) => `${wins}/${played} with other hosts (${lift})`,
    pairUsage:
      "Usage: `!admin pair <player> <player>` — mention, Discord id, or a single-word display name.",
    pairSamePlayer: "Pick two different players.",
    pairHeader: (left, right) =>
      `Games where **${left}** and **${right}** shared a round (newest 30).`,
    pairNone: "No completed game where one hosted and the other guessed.",
    pairGameLine: ({
      gameId,
      when,
      gmName,
      winnerName,
      countryCode,
      solve,
      median,
      flags,
      source,
    }) =>
      `\`${gameId}\` ${when} — host **${gmName}**, winner **${winnerName}**, ${countryCode}, solve ${solve} (country median ${median}), ${flags}, start ${source}.`,
    playerUsage: "Usage: `!admin player <player>` — mention, Discord id, or display name.",
    playerSummary: ({
      name,
      discordUserId,
      wins,
      played,
      rawRate,
      shrunk,
      prior,
      firstCorrect,
      firstGames,
      firstRate,
      concentration,
      created,
    }) =>
      [
        `**${name}** (\`${discordUserId}\`)`,
        `Wins **${wins}** / played **${played}** (${rawRate}). Shrunk rate **${shrunk}** toward the community rate **${prior}**.`,
        `First guess correct: **${firstCorrect}** / **${firstGames}** (${firstRate}).`,
        `Win concentration across hosts: **${concentration}** (1.00 means every win came from one host).`,
        `Discord account created: ${created}.`,
      ].join("\n"),
    playerNoWins: "No completed wins to group by host.",
    playerHostLine: (name, discordUserId, wins, totalWins) =>
      `**${name}** (\`${discordUserId}\`) — ${wins}/${totalWins} wins`,
    gameUsage: "Usage: `!admin game <id>`.",
    gameMissing: "No game with that id.",
    gameHeader: ({
      id,
      status,
      source,
      gmName,
      gmDiscordUserId,
      winner,
      country,
      solve,
      median,
      winnerWrong,
      clockNote,
    }) =>
      [
        `Game \`${id}\` (${status}, start ${source})`,
        `Host **${gmName}** (\`${gmDiscordUserId}\`)`,
        `Winner: ${winner}`,
        `Country: **${country}**`,
        `Solve ${solve} (country median ${median}). Winner's unique wrong guesses: **${winnerWrong}**.`,
        clockNote,
      ].join("\n"),
    gameClockAnnouncement: "Times are measured from the announcement.",
    gameClockStart: "This game has no announcement time. The clock starts at game start.",
    gameGuessLine: ({ seconds, name, raw, country, kind }) =>
      `${seconds} **${name}** \`${raw}\` → ${country} ${kind}`,
    gameGuessKind: (kind) =>
      kind === "correct"
        ? "correct"
        : kind === "repeat"
          ? "repeat"
          : kind === "limited"
            ? "limited"
            : "wrong",
    gameNoGuesses: "No guesses recorded.",
    gameTruncated: "Showing the first 60 guesses.",
    fastUsage: "Usage: `!admin fast <seconds>` — integer from **1** to **86400**.",
    fastNone: (seconds) => `No completed win solved in **${seconds}s** or less.`,
    fastHeader: (seconds, count) =>
      `Wins solved in **${seconds}s** or less (showing **${count}**, fastest first).`,
    fastLine: ({
      solve,
      winnerName,
      winnerDiscordUserId,
      gmName,
      gmDiscordUserId,
      countryCode,
      median,
      flags,
      gameId,
    }) =>
      `${solve} **${winnerName}** (\`${winnerDiscordUserId}\`) beat **${gmName}** (\`${gmDiscordUserId}\`) in ${countryCode} (median ${median}) ${flags} \`${gameId}\``,
    dismissUsage:
      "Usage: `!admin dismiss pair <player> <player>` — mention, Discord id, or a single-word display name.",
    dismissDone: (left, right) =>
      `Cleared **${left}** and **${right}** from the review list, in both directions.`,
    dismissAlready: (left, right) => `**${left}** and **${right}** were already cleared.`,
    reviewPlayerNotFound: (name) => `No player found for **${name}**.`,
    reviewPlayerAmbiguous: (name, matches) =>
      `Several players match **${name}**: ${matches.join(", ")}. Use a Discord id or mention.`,
    reviewStartSource: (source) =>
      source === "dm"
        ? "DM"
        : source === "channel"
          ? "channel"
          : source === "hybrid"
            ? "hybrid"
            : "unknown",
    reviewFlag: (flag) =>
      flag === "silent"
        ? "silent"
        : flag === "fast"
          ? "fast"
          : flag === "multiplier"
            ? "multiplier"
            : flag === "repeat"
              ? "repeat pin"
              : "cleared",
    startsUsage: "Usage: `!admin starts` shows the switch. `!admin starts on` or `off` changes it.",
    startsState: (enabled) =>
      enabled
        ? "New game starts are **open**."
        : "New game starts are **closed**. A game already in progress keeps running.",
    unknownCommand:
      "Unknown admin command. Use `!admin help`, `status`, `cancel`, `reveal`, `clear-start`, `reload`, `tick`, `awards`, `feedback`, `achievements backfill`, `clear-guesses`, `max-guesses`, `starts`, `suspects`, `pair`, `player`, `game`, `fast`, or `dismiss pair`.",
  },
  feedback: {
    usage: "Usage: `!feedback <message>` — send feedback to the admin from a DM.",
    tooLong: (maxLength) => `Feedback must be ${maxLength} characters or fewer.`,
    playerNotFound: "You need to interact with the game at least once before sending feedback.",
    rateLimited: (retryAfterMinutes) =>
      `Feedback limit reached: at most **4 messages per rolling hour**. Try again in about **${retryAfterMinutes} minute(s)**.`,
    saved: "Thanks — your feedback was sent to the admin.",
    adminUsage: [
      "Usage:",
      "`!admin feedback [limit]` — view recent feedback (default: 20, max: 50)",
      "`!admin feedback <id>` — view one feedback message in full",
      "`!admin feedback clear <username>` — clear that player's feedback rate limit",
    ].join("\n"),
    adminRateLimitClearUsage: "Usage: `!admin feedback clear <username>`.",
    adminRateLimitCleared: (displayName) =>
      `Cleared the feedback rate limit for **${displayName}**.`,
    adminPlayerNotFound: (displayName) => `No player found with the username **${displayName}**.`,
    adminPlayerAmbiguous: (displayName, matches) =>
      `More than one player matches **${displayName}**: ${matches.join(", ")}. Use a unique username.`,
    adminHeader: (count) => `**Recent player feedback** (${count})`,
    adminRow: ({ id, displayName, discordUserId, createdAt, message }) =>
      [`**${id}** — **${displayName}** (<@${discordUserId}>) — ${createdAt}`, message].join("\n"),
    noFeedback: "No feedback has been submitted yet.",
    notFound: "Feedback not found. Use the full ID from `!admin feedback`.",
    adminDetail: ({ id, displayName, discordUserId, createdAt }) =>
      `**Feedback ${id}** — **${displayName}** (<@${discordUserId}>) — ${createdAt}`,
  },
  achievements: {
    name: (id) => achievementNamesEn[id] ?? id,
    description: (id) => achievementDescriptionsEn[id] ?? "",
    unlockedDm: (id, tier) => {
      const name = achievementNamesEn[id] ?? id;
      const tierLabel = formatAchievementTier(id, tier);
      return tierLabel ? `Unlocked: **${name}** (${tierLabel})` : `Unlocked: **${name}**`;
    },
    unlockedChannel: (id, tier, displayName) => {
      const name = achievementNamesEn[id] ?? id;
      const tierLabel = formatAchievementTier(id, tier);
      return tierLabel
        ? `Achievement unlocked: **${name}** (${tierLabel}) — ${displayName}`
        : `Achievement unlocked: **${name}** — ${displayName}`;
    },
    header: "**Your achievements**",
    listHeader: "**Achievement catalog**",
    progressLine: (id, earnedTiers, nextTier, currentValue, streakCurrent) => {
      const name = achievementNamesEn[id] ?? id;
      const earned = earnedTiers.length > 0 ? earnedTiers.map(String).join(",") : "—";
      const next =
        nextTier === null ? "max" : (formatAchievementTier(id, nextTier) ?? String(nextTier));
      const streak = streakCurrent === undefined ? "" : ` · current streak **${streakCurrent}**`;
      return `**${name}** · earned [${earned}] · now **${currentValue}** · next **${next}**${streak}`;
    },
    empty: "No achievements unlocked yet.",
    usage: "Usage: `!achievements` or `!achievements list` (works in the game channel or DM).",
    dmUsage:
      "In DM you can use `!achievements` or `!achievements list`. Other commands belong in the game channel.",
    hiddenDescription: "Hidden until earned.",
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
    wrongGuessCount: (count) => `Wrong guesses: **${count}**.`,
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
