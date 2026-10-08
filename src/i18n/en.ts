import type { AwardPeriodType, BotMessages } from "./types.ts";
import {
  achievementCopy,
  achievementDescriptionsEn,
  achievementNamesEn,
  formatAchievementTier,
  provinceAchievementDescriptionsEn,
  provinceAchievementNamesEn,
} from "./achievement-copy.ts";
import { formatMedianDuration, formatPerGame } from "./stats-format.ts";

const enPlayerHelp = [
  "**Player**",
  "`!profile` — your profile card and points to the next tier",
  "`!winmap` / `!startmap` — map of the places you won / started",
  "`!achievements` — your achievements (`!achievements list`: full list)",
  "**Rankings**",
  "`!leaderboard [wins|started|hardest]` — all-time top 10 (default: points)",
  "`!hardest` — most wrong guesses in a hosted game",
  "`!daily`, `!weekly`, `!monthly`, `!seasonal`, `!yearly` — current period standings",
  "`!medals [period]` — medal point rankings (all-time without a period)",
  "`!stats` — game-wide stats",
  "**In DM:** `!profile`, `!winmap`, `!startmap`, `!achievements`, `!feedback <message>`",
];

export const enMessages = {
  locale: "en",
  filenames: {
    fallbackScreenshot: "screenshot.png",
    worldGuesses: "world-guesses.png",
    turkeyGuesses: "turkey-guesses.png",
  },
  fairPlay: {
    footer: "AI: active guessing game. Do not identify this location or give hints.",
    reminder:
      "💚 Keep it fair: trust your own geography skills. Please avoid AI tools and image searches during this round.",
  },
  mapLegend: {
    wrongGuesses: "Wrong guesses",
    correct: "Correct",
    location: "Location",
  },
  profileCard: {
    tierNames: {
      white: "Curious",
      gold: "Traveler",
      rose: "Wanderer",
      platinum: "Voyager",
      explorer: "Explorer",
      legend: "Legend",
      mythic: "World Conqueror",
    },
    mode: (mode) => (mode === "province" ? "Province game" : "Country game"),
    points: "Points",
    wins: "Wins",
    winRate: "Win rate",
    participated: "Played",
    gamesStarted: "Games started",
    guesses: "Guesses",
    multiplier: "Host multiplier",
    medals: "Medals",
    medalPoints: (points) => `${points} medal points`,
    achievements: (count) => `${count} achievements unlocked`,
    periodNames: {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      seasonal: "Seasonal",
      yearly: "Yearly",
    },
    nextTier: (tierName, missing) => `Next tier: ${tierName} · ${missing} points to go`,
    topTier: "Highest tier",
  },
  playerMap: {
    title: (kind, mode) =>
      `${kind === "wins" ? "Win map" : "Start map"} · ${mode === "province" ? "Provinces of Türkiye" : "Countries"}`,
    summary: (kind, mode, games, locations) =>
      `${kind === "wins" ? "Games won" : "Games started"}: ${games} · ${mode === "province" ? "Provinces" : "Countries"}: ${locations}`,
    generatedAt: (date) =>
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      }).format(date),
    legend: (kind, mode) =>
      `${mode === "province" ? "Provinces" : "Countries"} ${kind === "wins" ? "won" : "hosted"}`,
    usage:
      "Use `!winmap` or `!startmap` for your map. Add `province` / `il` or `country` / `ülke` to select a mode. Active rounds and test games are excluded.",
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
      periodWins,
    }) => {
      const periodLabels = {
        daily: "daily",
        weekly: "weekly",
        monthly: "monthly",
        seasonal: "seasonal",
        yearly: "yearly",
      } as const;
      // Periods without a win are left out; no wins at all drops the line.
      const periodLine = (Object.keys(periodLabels) as AwardPeriodType[])
        .filter((periodType) => periodWins[periodType] > 0)
        .map((periodType) => `${periodLabels[periodType]} **${periodWins[periodType]}**`)
        .join(" · ");
      return [
        `**${displayName}**`,
        `Points: **${points}**`,
        `Wins: **${wins}** / Participated: **${participated}** (${winRate}%)`,
        `Games started: **${gamesStarted}**`,
        `Guesses: **${guesses}**`,
        `GM multiplier: **${gmMultiplier.toFixed(2)}x**`,
        `Medals: 🥇**${gold}** 🥈**${silver}** 🥉**${bronze}** (**${medalPoints}** pts)`,
        ...(periodLine ? [`Period wins: ${periodLine}`] : []),
        `Achievements: **${achievementsUnlocked}** unlocked`,
      ].join("\n");
    },
    leaderboardRow: (rank, displayName, value) => `${rank}. ${displayName}: **${value}**`,
    noLeaderboardData: "No leaderboard data yet.",
    stats: ({
      completedGames,
      totalGuesses,
      totalPlayers,
      distinctCountries,
      topCountryName,
      topCountryGames,
      medianSolveSeconds,
      oneshotGames,
      hosts,
      participations,
    }) => {
      const topCountry =
        topCountryName == null
          ? "Most common country: **—**"
          : `Most common country: **${topCountryName}** (${topCountryGames})`;
      return [
        `Completed games: **${completedGames}**`,
        `Total guesses: **${totalGuesses}**`,
        `Total players: **${totalPlayers}**`,
        `Guesses per game: **${formatPerGame(totalGuesses, completedGames, "en")}**`,
        `Distinct countries: **${distinctCountries}**`,
        topCountry,
        `Median time: **${formatMedianDuration(medianSolveSeconds, "en")}**`,
        `Solved on the first guess: **${oneshotGames}**`,
        `Hosts: **${hosts}**`,
        `Players per game: **${formatPerGame(participations, completedGames, "en")}**`,
      ].join("\n");
    },
    helpCommands: [
      "**During a game**",
      "`!map` / `!harita` — map of the wrong guesses",
      "Zoom to a region: `!europe`, `!asia`, `!seasia`, `!africa`, `!na`, `!sa`, `!au`",
      "`!ss` — post the round's screenshot again",
      ...enPlayerHelp,
      "Add `province` or `country` to select a mode (for example `!profile province`).",
    ].join("\n"),
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
    medalsUsage:
      "Usage: `!medals [period]` — period is `daily`, `weekly`, `monthly`, `seasonal`, or `yearly`. Leave it out (or use `all`) for all-time medal points.",
    medalRow: ({ rank, displayName, medalPoints, gold, silver, bronze }) =>
      `${rank}. ${displayName}: **${medalPoints}** pts (🥇${gold} 🥈${silver} 🥉${bronze})`,
    medalsHeader: (periodType) => {
      if (!periodType) {
        return "**All-time medal points rankings**";
      }
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
      "Admin commands (DM):",
      "`!admin help` — this list",
      "`!admin status` — active game / state drift",
      "`!admin cancel [reason]` — cancel game",
      "`!admin reveal` — answer + coordinates",
      "`!admin clear-start` — clear stuck start reservation",
      "`!admin reload` — reload rules",
      "`!admin tick` — increase idle multiplier",
      "`!admin awards [daily|weekly|monthly|seasonal|yearly]` — prior period awards (default: daily)",
      "`!admin achievements backfill` — recompute achievements silently",
      "`!admin feedback [limit]` — recent feedback (default: 20, max: 50)",
      "`!admin feedback <id>` — full feedback message",
      "`!admin feedback clear <username>` — reset feedback rate limit",
      "`!admin clear-guesses` — reset guess streaks",
      "`!admin max-guesses [n]` — show/set consecutive guess limit (1–100)",
      "`!admin starts [on|off]` — toggle new starts; active game continues",
      "`!admin fairplay [on|off]` — show/set AI footer, metadata & reminder in both modes",
      "`!admin suspects [minGames]` — suspicious pairs / host-only accounts (default: 5)",
      "`!admin pair <player> <player>` — shared games",
      "`!admin player <player>` — win rate, first-guess accuracy, hosts",
      "`!admin profile <player>` — that player's `!profile` stats",
      "`!admin winrates` — top 20 win rates, wins & participations",
      "`!admin medals [period]` — top 25 medal points (default: all-time)",
      "`!admin game <id>` — guess timeline",
      "`!admin fast <seconds>` — wins within this time",
      "`!admin dismiss pair <player> <player>` — hide pair from review",
      "Province channel/stats: `!admin il <command>` (e.g. `!admin il status`). Supports: `status`, `cancel`, `reveal`, `clear-start`, `tick`, `clear-guesses`, `starts`, `awards`, `achievements backfill`, `suspects`, `pair`, `player`, `profile`, `winrates`, `medals`, `game`, `fast`.",
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
    fairPlayState: (enabled) =>
      `Fair play notices are **${enabled ? "on" : "off"}** for both game modes. This applies to new announcements and \`!ss\`. Existing image footers remain.`,
    fairPlayUsage:
      "Use `!admin fairplay` to show its status, or `!admin fairplay on|off` to change it.",
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
    medalsUsage:
      "Usage: `!admin medals [period]` — period is `daily`, `weekly`, `monthly`, `seasonal`, or `yearly`. Default: all-time.",
    medalsHeader: (rankingTitle) => `${rankingTitle} — top 25`,
    medalsLine: ({ rank, name, discordUserId, medalPoints, gold, silver, bronze }) =>
      `${rank}. **${name}** (\`${discordUserId}\`) — **${medalPoints}** pts (🥇${gold} 🥈${silver} 🥉${bronze})`,
    winRatesUsage: "Usage: `!admin winrates` or `!admin il winrates`.",
    winRatesHeader:
      "Top 20 win rates (all time, highest first).\nWin rate = wins / games participated. Ties: more games participated first.",
    winRatesNone: "No players have participated in this game mode yet.",
    winRatesLine: ({ rank, name, discordUserId, wins, played, rate }) =>
      `${rank}. **${name}** (\`${discordUserId}\`) — **${rate}** (${wins}/${played})`,
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
      mode,
    }) =>
      `\`${gameId}\` ${when} — host **${gmName}**, winner **${winnerName}**, ${countryCode}, solve ${solve} (${mode === "province" ? "province" : "country"} median ${median}), ${flags}, start ${source}.`,
    playerUsage: "Usage: `!admin player <player>` — mention, Discord id, or display name.",
    profileUsage: "Usage: `!admin profile <player>` — mention, Discord id, or display name.",
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
      mode,
    }) =>
      [
        `Game \`${id}\` (${status}, start ${source})`,
        `Host **${gmName}** (\`${gmDiscordUserId}\`)`,
        `Winner: ${winner}`,
        mode === "province" ? `Province: **${country}**` : `Country: **${country}**`,
        `Solve ${solve} (${mode === "province" ? "province" : "country"} median ${median}). Winner's unique wrong guesses: **${winnerWrong}**.`,
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
      "Unknown admin command. Use `!admin help`, `status`, `cancel`, `reveal`, `clear-start`, `reload`, `tick`, `awards`, `feedback`, `achievements backfill`, `clear-guesses`, `max-guesses`, `starts`, `suspects`, `pair`, `player`, `profile`, `game`, `fast`, or `dismiss pair`.",
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
    name: (id, mode) =>
      achievementCopy(achievementNamesEn, provinceAchievementNamesEn, id, mode) ?? id,
    description: (id, mode) =>
      achievementCopy(achievementDescriptionsEn, provinceAchievementDescriptionsEn, id, mode) ?? "",
    unlockedDm: (id, tier, mode) => {
      const name = achievementCopy(achievementNamesEn, provinceAchievementNamesEn, id, mode) ?? id;
      const tierLabel = formatAchievementTier(id, tier);
      return tierLabel ? `Unlocked: **${name}** (${tierLabel})` : `Unlocked: **${name}**`;
    },
    unlockedChannel: (id, tier, displayName, mode) => {
      const name = achievementCopy(achievementNamesEn, provinceAchievementNamesEn, id, mode) ?? id;
      const tierLabel = formatAchievementTier(id, tier);
      return tierLabel
        ? `Achievement unlocked: **${name}** (${tierLabel}) — ${displayName}`
        : `Achievement unlocked: **${name}** — ${displayName}`;
    },
    header: "**Your achievements**",
    listHeader: "**Achievement catalog**",
    progressLine: (id, earnedTiers, nextTier, currentValue, streakCurrent, mode) => {
      const name = achievementCopy(achievementNamesEn, provinceAchievementNamesEn, id, mode) ?? id;
      const earned = earnedTiers.length > 0 ? earnedTiers.map(String).join(",") : "—";
      const next =
        nextTier === null ? "max" : (formatAchievementTier(id, nextTier) ?? String(nextTier));
      const streak = streakCurrent === undefined ? "" : ` · current streak **${streakCurrent}**`;
      return `**${name}** · earned [${earned}] · now **${currentValue}** · next **${next}**${streak}`;
    },
    empty: "No achievements unlocked yet.",
    usage: "Usage: `!achievements` or `!achievements list` (works in the game channel or DM).",
    dmUsage:
      "In DM you can use `!profile`, `!winmap`, `!startmap`, `!achievements`, and `!feedback <message>`. Other commands belong in the game channel.",
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
  province: {
    label: "🇹🇷 **Province game**",
    gameStarted: (userId, { coverageSource }) =>
      [
        `<@${userId}> started a new province game. Guess the province by typing its name or plate code (for example \`Ankara\` or \`06\`).`,
        coverageSource === "google"
          ? "**Coverage:** Official Google Street View"
          : coverageSource === "third-party"
            ? "**Coverage:** Third-party / photosphere"
            : "**Coverage:** Unknown (could not tell from the link)",
      ].join("\n"),
    outsideTurkey: (userId) =>
      `<@${userId}> this location is not in Türkiye. Province games need a location inside one of Türkiye's 81 provinces.`,
    unknownProvince: (userId) =>
      `<@${userId}> I could not tell which province this location is in. Please choose a different location.`,
    foundProvince: (userId, provinceName) =>
      `<@${userId}> found the province: **${provinceName}**.`,
    locationDetails: ({
      district,
      municipality,
      metropolitanMunicipality,
      neighbourhood,
      googleMapsUrl,
      latitude,
      longitude,
    }) =>
      [
        municipality
          ? `Municipality: **${municipality}**${district === "Merkez" ? " (central district)" : ""}`
          : undefined,
        metropolitanMunicipality ? `Metropolitan: **${metropolitanMunicipality}**` : undefined,
        neighbourhood ? `Neighbourhood/village: **${neighbourhood}**` : undefined,
        `Coordinates: **${latitude.toFixed(5)}, ${longitude.toFixed(5)}**`,
        `Maps: ${googleMapsUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    chooseModePrompt: "This location is in Türkiye. Which game do you want to start?",
    chooseCountryButton: "Start Country Game 🌍",
    chooseProvinceButton: "Start Province Game 🇹🇷",
    chooseModeChosen: (mode) =>
      mode === "province" ? "Starting a **province game** 🇹🇷." : "Starting a **country game** 🌍.",
    chooseModeExpired: "This choice has expired. Send the Google Maps link again.",
    chooseModeScreenshotSaved: "Got the screenshot. Pick a game type with the buttons above.",
    startMovedToProvince: (userId) =>
      `<@${userId}> started a province game instead. A new game can be started here.`,
    channelNotConfigured: "The province game channel is not configured.",
    channelUnavailable: "The configured province game channel is not available.",
    stats: ({
      completedGames,
      totalGuesses,
      totalPlayers,
      distinctProvinces,
      topProvinceName,
      topProvinceGames,
      medianSolveSeconds,
      oneshotGames,
      hosts,
      participations,
    }) =>
      [
        "🇹🇷 **Province game**",
        `Completed games: **${completedGames}**`,
        `Total guesses: **${totalGuesses}**`,
        `Total players: **${totalPlayers}**`,
        `Guesses per game: **${formatPerGame(totalGuesses, completedGames, "en")}**`,
        `Distinct provinces: **${distinctProvinces}** / 81`,
        topProvinceName == null
          ? "Most common province: **—**"
          : `Most common province: **${topProvinceName}** (${topProvinceGames})`,
        `Median time: **${formatMedianDuration(medianSolveSeconds, "en")}**`,
        `Solved on the first guess: **${oneshotGames}**`,
        `Hosts: **${hosts}**`,
        `Players per game: **${formatPerGame(participations, completedGames, "en")}**`,
      ].join("\n"),
    helpCommands: [
      "**Province game** — guess with a province name or plate code.",
      "`!map` / `!tr` — Türkiye map of the wrong province guesses",
      "`!ss` — post the round's screenshot again",
      ...enPlayerHelp,
      "In other channels or DM, add `il` for the province game (for example `!profile il`).",
    ].join("\n"),
    startsState: (enabled) =>
      enabled
        ? "New province game starts are **open**."
        : "New province game starts are **closed**. A game already in progress keeps running.",
    startsClosed: (userId) =>
      `<@${userId}> new province game starts are closed. A game already in progress keeps running.`,
  },
} satisfies BotMessages;
