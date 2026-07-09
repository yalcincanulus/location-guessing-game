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
};

export type GameStatsMessageInput = {
  completedGames: number | string;
  totalGames: number | string;
  totalGuesses: number | string;
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
    nowSendScreenshot: string;
    nowSendGoogleMapsLink: string;
    sendLinkAndScreenshot: string;
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
  game: {
    foundCountry: (userId: string, countryName: string) => string;
    locationDetails: (input: {
      regionName?: string;
      googleMapsUrl: string;
      latitude: number;
      longitude: number;
    }) => string;
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
  };
};
