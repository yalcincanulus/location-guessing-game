import type { BotLocale } from "./locale.ts";
import type { PlayerMapKind } from "../domain/maps/player-map-renderer.ts";

export type ProfileMessageInput = {
  displayName: string;
  points: number | string;
  wins: number;
  participated: number;
  winRate: number;
  gamesStarted: number | string;
  guesses: number | string;
  gmMultiplier: number;
  medalPoints: number;
  gold: number;
  silver: number;
  bronze: number;
  achievementsUnlocked: number;
};

export type GameStatsMessageInput = {
  completedGames: number | string;
  totalGuesses: number | string;
  totalPlayers: number | string;
  distinctCountries: number | string;
  topCountryName: string | null;
  topCountryGames: number | string;
  medianSolveSeconds: number | null;
  oneshotGames: number | string;
  hosts: number | string;
  participations: number | string;
};

export type ProvinceStatsMessageInput = {
  completedGames: number | string;
  totalGuesses: number | string;
  totalPlayers: number | string;
  distinctProvinces: number | string;
  topProvinceName: string | null;
  topProvinceGames: number | string;
  medianSolveSeconds: number | null;
  oneshotGames: number | string;
  hosts: number | string;
  participations: number | string;
};

export type MessageGameMode = "country" | "province";

export type AwardPeriodType = "daily" | "weekly" | "monthly" | "seasonal" | "yearly";
export type AwardCategory = "points" | "wins" | "started" | "hardest";

export type MedalLeaderboardMessageInput = {
  rank: number;
  displayName: string;
  medalPoints: number;
  gold: number;
  silver: number;
  bronze: number;
};

export type TestStatusMessageInput = {
  game?: {
    id: string;
    status: string;
    gameMasterDiscordUserId: string;
    target: string;
    regionName?: string;
  };
  wrongCountryCount: number;
  currentMultiplier: number;
  isTestGame: boolean;
  redisMissingButDbActive: boolean;
};

export type TestRevealMessageInput = {
  redisMissingButDbActive: boolean;
  answer: string;
  regionName?: string;
  latitude: number;
  longitude: number;
};

export type BotMessages = {
  locale: BotLocale;
  filenames: {
    fallbackScreenshot: string;
    worldGuesses: string;
    turkeyGuesses: string;
  };
  fairPlay: {
    footer: string;
    reminder: string;
  };
  mapLegend: {
    wrongGuesses: string;
    correct: string;
    location: string;
  };
  playerMap: {
    title: (kind: PlayerMapKind, mode: MessageGameMode) => string;
    summary: (
      kind: PlayerMapKind,
      mode: MessageGameMode,
      games: number,
      locations: number,
    ) => string;
    generatedAt: (date: Date) => string;
    legend: (kind: PlayerMapKind, mode: MessageGameMode) => string;
    usage: string;
  };
  start: {
    gameChannelNotConfigured: string;
    configuredGameChannelUnavailable: string;
    activeGameAlreadyExists: string;
    couldNotExtractCoordinates: string;
    untrustedLocation: string;
    gameStarted: (
      userId: string,
      input: {
        inTheGame: boolean;
        coverageSource: "google" | "third-party" | "unknown";
      },
    ) => string;
    needsVerifiedRole: string;
    startingWaitingForScreenshot: (userId: string) => string;
    startingWaitingForLink: (userId: string) => string;
    startReservationExpired: (userId: string, missing: "screenshot" | "link") => string;
    screenshotTooLarge: (userId: string, maxMb: number) => string;
    startsClosed: (userId: string) => string;
  };
  commands: {
    noActiveGameInChannel: string;
    couldNotLoadScreenshot: string;
    noProfileYet: string;
    profile: (input: ProfileMessageInput) => string;
    leaderboardRow: (rank: number, displayName: string, value: number | string) => string;
    noLeaderboardData: string;
    stats: (input: GameStatsMessageInput) => string;
    helpCommands: string;
    helpTestCommands: string;
  };
  awards: {
    liveHeader: (periodType: AwardPeriodType, periodKey: string) => string;
    resultsHeader: (periodType: AwardPeriodType, periodKey: string) => string;
    categoryTitle: (category: AwardCategory) => string;
    standingRow: (
      rank: number,
      displayName: string,
      value: number | string,
      medalEmoji?: string,
    ) => string;
    noCategoryData: string;
    noMedalData: string;
    medalsUsage: string;
    medalRow: (input: MedalLeaderboardMessageInput) => string;
    /** Without a period type, the header is for all-time medal points. */
    medalsHeader: (periodType?: AwardPeriodType) => string;
  };
  test: {
    modeDisabled: string;
    onlyInTestChannel: string;
    notEnabledForUser: string;
    noActiveGameInTestChannel: string;
    cancelledGame: (gameId: string) => string;
    resetGameState: string;
    status: (input: TestStatusMessageInput) => string;
    redisMissingButDbActive: string;
    reveal: (input: TestRevealMessageInput) => string;
    multiplierCapped: (currentMultiplier: number) => string;
    forcedMultiplierTick: (previousMultiplier: number, newMultiplier: number) => string;
    multiplierNoChange: string;
    sampleMap: (correctCountry: string, wrongCountries: string[]) => string;
    unknownCommand: string;
  };
  admin: {
    help: string;
    gameChannelNotConfigured: string;
    gameChannelUnavailable: string;
    noActiveGame: string;
    cancelledGame: (gameId: string) => string;
    cancelledAnnouncement: (gameId: string, reason: string) => string;
    status: (input: TestStatusMessageInput) => string;
    reveal: (input: TestRevealMessageInput) => string;
    clearStartDone: string;
    noStartState: string;
    rulesReloaded: string;
    fairPlayState: (enabled: boolean) => string;
    fairPlayUsage: string;
    guessesCleared: string;
    maxGuessesCurrent: (current: number) => string;
    maxGuessesUpdated: (previous: number, next: number) => string;
    maxGuessesUsage: (current: number, min: number, max: number) => string;
    multiplierCapped: (currentMultiplier: number) => string;
    forcedMultiplierTick: (previousMultiplier: number, newMultiplier: number) => string;
    multiplierNoChange: string;
    awardsFinalized: (periodType: string, periodKey: string, medalCount: number) => string;
    awardsAlreadyAnnounced: (periodType: string, periodKey: string) => string;
    awardsAnnounceFailed: (periodType: string, periodKey: string) => string;
    awardsInvalidPeriod: string;
    achievementsBackfillDone: (players: number, unlocks: number, errors: number) => string;
    reviewSentToDm: string;
    reviewDmFailed: string;
    reviewEmpty: string;
    medalsUsage: string;
    medalsHeader: (rankingTitle: string) => string;
    medalsLine: (
      input: Omit<MedalLeaderboardMessageInput, "displayName"> & {
        name: string;
        discordUserId: string;
      },
    ) => string;
    winRatesUsage: string;
    winRatesHeader: string;
    winRatesNone: string;
    winRatesLine: (input: {
      rank: number;
      name: string;
      discordUserId: string;
      wins: number;
      played: number;
      rate: string;
    }) => string;
    suspectsUsage: string;
    suspectsHeader: (
      minGames: number,
      shownPairs: number,
      pairCount: number,
      shownHosts: number,
      hostCount: number,
    ) => string;
    suspectsNoPairs: string;
    suspectsHostHeader: string;
    suspectsNoHosts: string;
    suspectPairLine: (input: {
      gmName: string;
      gmDiscordUserId: string;
      playerName: string;
      playerDiscordUserId: string;
      winsWith: number;
      playedWith: number;
      elsewhere: string;
      silentWins: number;
      fastWins: number;
      medianSolve: string;
    }) => string;
    suspectHostLine: (input: {
      name: string;
      discordUserId: string;
      started: number;
      participated: number;
      won: number;
      created: string;
      winnerName: string;
      winnerDiscordUserId: string;
      topWins: number;
      completed: number;
    }) => string;
    reviewElsewhereNone: string;
    reviewElsewhereZero: (played: number) => string;
    reviewElsewhere: (wins: number, played: number, lift: string) => string;
    pairUsage: string;
    pairSamePlayer: string;
    pairHeader: (left: string, right: string) => string;
    pairNone: string;
    pairGameLine: (input: {
      gameId: string;
      when: string;
      gmName: string;
      winnerName: string;
      countryCode: string;
      solve: string;
      median: string;
      flags: string;
      source: string;
      mode?: MessageGameMode;
    }) => string;
    playerUsage: string;
    profileUsage: string;
    playerSummary: (input: {
      name: string;
      discordUserId: string;
      wins: number;
      played: number;
      rawRate: string;
      shrunk: string;
      prior: string;
      firstCorrect: number;
      firstGames: number;
      firstRate: string;
      concentration: string;
      created: string;
    }) => string;
    playerNoWins: string;
    playerHostLine: (
      name: string,
      discordUserId: string,
      wins: number,
      totalWins: number,
    ) => string;
    gameUsage: string;
    gameMissing: string;
    gameHeader: (input: {
      id: string;
      status: string;
      source: string;
      gmName: string;
      gmDiscordUserId: string;
      winner: string;
      country: string;
      solve: string;
      median: string;
      winnerWrong: string;
      clockNote: string;
      mode?: MessageGameMode;
    }) => string;
    gameClockAnnouncement: string;
    gameClockStart: string;
    gameGuessLine: (input: {
      seconds: string;
      name: string;
      raw: string;
      country: string;
      kind: string;
    }) => string;
    gameGuessKind: (kind: "correct" | "wrong" | "repeat" | "limited") => string;
    gameNoGuesses: string;
    gameTruncated: string;
    fastUsage: string;
    fastNone: (seconds: number) => string;
    fastHeader: (seconds: number, count: number) => string;
    fastLine: (input: {
      solve: string;
      winnerName: string;
      winnerDiscordUserId: string;
      gmName: string;
      gmDiscordUserId: string;
      countryCode: string;
      median: string;
      flags: string;
      gameId: string;
      mode?: MessageGameMode;
    }) => string;
    dismissUsage: string;
    dismissDone: (left: string, right: string) => string;
    dismissAlready: (left: string, right: string) => string;
    reviewPlayerNotFound: (name: string) => string;
    reviewPlayerAmbiguous: (name: string, matches: string[]) => string;
    reviewStartSource: (source: string | null) => string;
    reviewFlag: (flag: "silent" | "fast" | "multiplier" | "repeat" | "cleared") => string;
    startsUsage: string;
    startsState: (enabled: boolean) => string;
    unknownCommand: string;
  };
  feedback: {
    usage: string;
    tooLong: (maxLength: number) => string;
    playerNotFound: string;
    rateLimited: (retryAfterMinutes: number) => string;
    saved: string;
    adminUsage: string;
    adminRateLimitClearUsage: string;
    adminRateLimitCleared: (displayName: string) => string;
    adminPlayerNotFound: (displayName: string) => string;
    adminPlayerAmbiguous: (displayName: string, matches: string[]) => string;
    adminHeader: (count: number) => string;
    adminRow: (input: {
      id: string;
      displayName: string;
      discordUserId: string;
      createdAt: string;
      message: string;
    }) => string;
    noFeedback: string;
    notFound: string;
    adminDetail: (input: {
      id: string;
      displayName: string;
      discordUserId: string;
      createdAt: string;
    }) => string;
  };
  achievements: {
    name: (id: string, mode?: MessageGameMode) => string;
    description: (id: string, mode?: MessageGameMode) => string;
    unlockedDm: (id: string, tier: number | null, mode?: MessageGameMode) => string;
    unlockedChannel: (
      id: string,
      tier: number | null,
      displayName: string,
      mode?: MessageGameMode,
    ) => string;
    header: string;
    listHeader: string;
    progressLine: (
      id: string,
      earnedTiers: number[],
      nextTier: number | null,
      currentValue: number | string,
      streakCurrent?: number,
      mode?: MessageGameMode,
    ) => string;
    empty: string;
    usage: string;
    dmUsage: string;
    hiddenDescription: string;
  };
  game: {
    foundCountry: (userId: string, countryName: string) => string;
    locationDetails: (input: {
      regionName?: string;
      googleMapsUrl: string;
      latitude: number;
      longitude: number;
    }) => string;
    wrongGuessCount: (count: number) => string;
    testNoPoints: string;
    reward: (
      points: number,
      basePoints: number,
      currentMultiplier: number,
      gmMultiplier: number,
    ) => string;
    osmAttribution: string;
  };
  jobs: {
    multiplierIncreased: (currentMultiplier: number) => string;
    channelIdleReminder: string;
  };
  /** Turkish province mode. */
  province: {
    /** First line on province stats, standings, and admin output. */
    label: string;
    gameStarted: (
      userId: string,
      input: { coverageSource: "google" | "third-party" | "unknown" },
    ) => string;
    outsideTurkey: (userId: string) => string;
    unknownProvince: (userId: string) => string;
    foundProvince: (userId: string, provinceName: string) => string;
    /** Result details: municipality (belediye), neighbourhood, coordinates, link. */
    locationDetails: (input: {
      district?: string;
      municipality?: string;
      metropolitanMunicipality?: string;
      neighbourhood?: string;
      googleMapsUrl: string;
      latitude: number;
      longitude: number;
    }) => string;
    chooseModePrompt: string;
    chooseCountryButton: string;
    chooseProvinceButton: string;
    chooseModeChosen: (mode: MessageGameMode) => string;
    chooseModeExpired: string;
    chooseModeScreenshotSaved: string;
    startMovedToProvince: (userId: string) => string;
    channelNotConfigured: string;
    channelUnavailable: string;
    stats: (input: ProvinceStatsMessageInput) => string;
    helpCommands: string;
    startsState: (enabled: boolean) => string;
    startsClosed: (userId: string) => string;
  };
};
