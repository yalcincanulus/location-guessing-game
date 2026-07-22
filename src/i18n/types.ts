import type { BotLocale } from "./locale.ts";

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
  totalGames: number | string;
  totalGuesses: number | string;
};

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
  };
  mapLegend: {
    wrongGuesses: string;
    correct: string;
    location: string;
  };
  start: {
    gameChannelNotConfigured: string;
    configuredGameChannelUnavailable: string;
    activeGameAlreadyExists: string;
    couldNotExtractCoordinates: string;
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
    medalsHeader: (periodType: AwardPeriodType) => string;
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
    multiplierCapped: (currentMultiplier: number) => string;
    forcedMultiplierTick: (previousMultiplier: number, newMultiplier: number) => string;
    multiplierNoChange: string;
    awardsFinalized: (periodType: string, periodKey: string, medalCount: number) => string;
    awardsAlreadyAnnounced: (periodType: string, periodKey: string) => string;
    awardsAnnounceFailed: (periodType: string, periodKey: string) => string;
    awardsInvalidPeriod: string;
    achievementsBackfillDone: (players: number, unlocks: number, errors: number) => string;
    unknownCommand: string;
  };
  achievements: {
    name: (id: string) => string;
    description: (id: string) => string;
    unlockedDm: (id: string, tier: number | null) => string;
    unlockedChannel: (id: string, tier: number | null, displayName: string) => string;
    header: string;
    listHeader: string;
    progressLine: (
      id: string,
      earnedTiers: number[],
      nextTier: number | null,
      currentValue: number | string,
      streakCurrent?: number,
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
};
