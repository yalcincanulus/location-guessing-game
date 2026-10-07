import type { Message } from "discord.js";
import { messages } from "../i18n/messages.ts";
import {
  dismissReviewPair,
  getGameReview,
  getPlayerReview,
  listFastWins,
  listPairGames,
  listSuspects,
  type PairGameRow,
  type SuspectPair,
} from "../domain/review/queries.ts";
import { parsePlayerArgs, parsePlayerToken, type PlayerRef } from "../domain/review/player-ref.ts";
import { parseFastSeconds, parseMinSharedGames } from "../domain/review/scoring.ts";
import {
  findPlayerByDiscordUserId,
  findPlayersByDisplayName,
  getWinRateLeaderboard,
  type DbPlayer,
} from "../repositories/core-repository.ts";
import { getMedalLeaderboard } from "../repositories/awards-repository.ts";
import { ALL_TIME_ALIASES, PERIOD_ALIASES } from "../domain/awards/periods.ts";
import type { GameMode } from "../domain/game/game-mode.ts";
import { getProvinceName } from "../domain/provinces/normalize-province-guess.ts";
import { formatPlayerProfile } from "./player-profile.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

const REVIEW_COMMANDS = new Set([
  "suspects",
  "supheli",
  "supheliler",
  "pair",
  "cift",
  "player",
  "oyuncu",
  "profile",
  "profil",
  "game",
  "oyun",
  "fast",
  "hizli",
  "winrates",
  "winrate",
  "galibiyet",
  "medals",
  "madalya",
  "madalyalar",
  "dismiss",
  "kapat",
]);

const splitForDiscord = (lines: string[], maxLength = 1_900) => {
  const chunks: string[] = [];
  let chunk = "";

  const append = (line: string) => {
    if (!line) {
      return;
    }
    if (line.length > maxLength) {
      if (chunk) {
        chunks.push(chunk);
        chunk = "";
      }
      for (let offset = 0; offset < line.length; offset += maxLength) {
        chunks.push(line.slice(offset, offset + maxLength));
      }
      return;
    }
    const next = chunk ? `${chunk}\n${line}` : line;
    if (next.length > maxLength) {
      if (chunk) {
        chunks.push(chunk);
      }
      chunk = line;
    } else {
      chunk = next;
    }
  };

  for (const line of lines) {
    append(line);
  }
  if (chunk) {
    chunks.push(chunk);
  }
  return chunks;
};

const deliverPrivate = async (message: Message, lines: string[], mode: GameMode = "country") => {
  const body = lines.length > 0 ? lines : [messages.admin.reviewEmpty];
  const content = mode === "province" ? [messages.province.label, ...body] : body;
  const chunks = splitForDiscord(content);
  if (chunks.length === 0) {
    chunks.push(messages.admin.reviewEmpty);
  }
  const payload = (text: string) => ({ content: text, allowedMentions: { parse: [] } });

  if (!message.inGuild()) {
    for (const chunk of chunks) {
      await message.reply(payload(chunk));
    }
    return;
  }

  try {
    for (const chunk of chunks) {
      await message.author.send(payload(chunk));
    }
    await message.reply(payload(messages.admin.reviewSentToDm));
  } catch {
    await message.reply(payload(messages.admin.reviewDmFailed));
  }
};

const pct = (value: number) => `${Math.round(value * 100)}%`;

const secondsLabel = (value: number | null) => (value == null ? "—" : `${Math.round(value)}s`);

const accountLabel = (date: Date | null) => {
  if (!date) {
    return "—";
  }
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return `${day} (${days}d)`;
};

const whenLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

const clip = (value: string) => {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > 40 ? `${flat.slice(0, 39)}…` : flat;
};

const playerLabel = (player: DbPlayer) => `${player.displayName} (${player.discordUserId})`;

const resolveRef = async (
  ref: PlayerRef,
): Promise<
  | { ok: true; player: DbPlayer }
  | { ok: false; reason: "missing" | "ambiguous"; label: string; matches: string[] }
> => {
  if (ref.kind === "id") {
    const player = await findPlayerByDiscordUserId(ref.discordUserId);
    return player
      ? { ok: true, player }
      : { ok: false, reason: "missing", label: ref.discordUserId, matches: [] };
  }

  const players = await findPlayersByDisplayName(ref.displayName);
  if (players.length === 1 && players[0]) {
    return { ok: true, player: players[0] };
  }
  if (players.length === 0) {
    return { ok: false, reason: "missing", label: ref.displayName, matches: [] };
  }
  return {
    ok: false,
    reason: "ambiguous",
    label: ref.displayName,
    matches: players.map((player) => playerLabel(player)),
  };
};

const failureLines = (result: {
  reason: "missing" | "ambiguous";
  label: string;
  matches: string[];
}) =>
  result.reason === "missing"
    ? [messages.admin.reviewPlayerNotFound(result.label)]
    : [messages.admin.reviewPlayerAmbiguous(result.label, result.matches)];

const elsewhereLabel = (pair: SuspectPair) => {
  if (pair.verdict.otherRate === undefined) {
    return messages.admin.reviewElsewhereNone;
  }
  if (pair.winsOther === 0) {
    return messages.admin.reviewElsewhereZero(pair.playedOther);
  }
  const lift = pair.verdict.lift;
  const liftLabel = lift === undefined || !Number.isFinite(lift) ? "∞" : `${lift.toFixed(1)}x`;
  return messages.admin.reviewElsewhere(pair.winsOther, pair.playedOther, liftLabel);
};

const flagList = (flags: Array<"silent" | "fast" | "multiplier" | "repeat" | "cleared">) =>
  flags.length > 0 ? flags.map((flag) => messages.admin.reviewFlag(flag)).join(", ") : "—";

const pairFlags = (game: PairGameRow) =>
  flagList([
    ...(game.silent ? (["silent"] as const) : []),
    ...(game.fast ? (["fast"] as const) : []),
    ...(game.multiplierSnipe ? (["multiplier"] as const) : []),
    ...(game.repeatPin ? (["repeat"] as const) : []),
  ]);

/** Province rows show the plate code with the province name. */
const targetLabel = (mode: GameMode, code: string) =>
  mode === "province" ? `${code} ${getProvinceName(code)}` : code;

const suspectsCommand = async (message: Message, args: string[], mode: GameMode) => {
  if (args.length > 1) {
    await message.reply(messages.admin.suspectsUsage);
    return;
  }
  const minShared = parseMinSharedGames(args[0]);
  if (minShared === undefined) {
    await message.reply(messages.admin.suspectsUsage);
    return;
  }

  const report = await listSuspects(minShared, mode);
  const lines = [
    messages.admin.suspectsHeader(
      minShared,
      report.pairs.length,
      report.pairCount,
      report.hosts.length,
      report.hostCount,
    ),
    report.pairs.length === 0 ? messages.admin.suspectsNoPairs : "",
    ...report.pairs.map((pair) =>
      messages.admin.suspectPairLine({
        gmName: pair.gmName,
        gmDiscordUserId: pair.gmDiscordUserId,
        playerName: pair.playerName,
        playerDiscordUserId: pair.playerDiscordUserId,
        winsWith: pair.winsWith,
        playedWith: pair.playedWith,
        elsewhere: elsewhereLabel(pair),
        silentWins: pair.silentWins,
        fastWins: pair.fastWins,
        medianSolve: secondsLabel(pair.medianSolveSeconds),
      }),
    ),
    messages.admin.suspectsHostHeader,
    report.hosts.length === 0 ? messages.admin.suspectsNoHosts : "",
    ...report.hosts.map((host) =>
      messages.admin.suspectHostLine({
        name: host.displayName,
        discordUserId: host.discordUserId,
        started: host.gamesStarted,
        participated: host.gamesParticipated,
        won: host.gamesWon,
        created: accountLabel(host.discordCreatedAt),
        winnerName: host.winnerName,
        winnerDiscordUserId: host.winnerDiscordUserId,
        topWins: host.topWins,
        completed: host.completedHosted,
      }),
    ),
  ];
  await deliverPrivate(message, lines, mode);
};

const resolveTwo = async (message: Message, args: string[], usage: string) => {
  if (args.length !== 2) {
    await message.reply(usage);
    return undefined;
  }
  const leftRef = parsePlayerToken(args[0] ?? "");
  const rightRef = parsePlayerToken(args[1] ?? "");
  if (!leftRef || !rightRef) {
    await message.reply(usage);
    return undefined;
  }
  const left = await resolveRef(leftRef);
  if (!left.ok) {
    await deliverPrivate(message, failureLines(left));
    return undefined;
  }
  const right = await resolveRef(rightRef);
  if (!right.ok) {
    await deliverPrivate(message, failureLines(right));
    return undefined;
  }
  if (left.player.id === right.player.id) {
    await message.reply(messages.admin.pairSamePlayer);
    return undefined;
  }
  return { left: left.player, right: right.player };
};

const pairCommand = async (message: Message, args: string[], mode: GameMode) => {
  const resolved = await resolveTwo(message, args, messages.admin.pairUsage);
  if (!resolved) {
    return;
  }

  const games = await listPairGames(resolved.left.id, resolved.right.id, mode);
  const lines = [
    messages.admin.pairHeader(playerLabel(resolved.left), playerLabel(resolved.right)),
    games.length === 0 ? messages.admin.pairNone : "",
    ...games.map((game) =>
      messages.admin.pairGameLine({
        gameId: game.gameId,
        when: whenLabel(game.startedAt),
        gmName: game.gmName,
        winnerName: game.winnerName ?? "—",
        countryCode: targetLabel(mode, game.countryCode),
        solve: secondsLabel(game.solveSeconds),
        median: secondsLabel(game.countryMedianSeconds),
        flags: pairFlags(game),
        source: messages.admin.reviewStartSource(game.startSource),
        mode,
      }),
    ),
  ];
  await deliverPrivate(message, lines, mode);
};

const profileCommand = async (message: Message, args: string[], mode: GameMode) => {
  const ref = parsePlayerArgs(args);
  if (!ref) {
    await message.reply(messages.admin.profileUsage);
    return;
  }
  const resolved = await resolveRef(ref);
  if (!resolved.ok) {
    await deliverPrivate(message, failureLines(resolved));
    return;
  }

  const profile = await formatPlayerProfile(resolved.player.discordUserId, mode);
  await deliverPrivate(
    message,
    [profile ?? messages.admin.reviewPlayerNotFound(playerLabel(resolved.player))],
    mode,
  );
};

const playerCommand = async (message: Message, args: string[], mode: GameMode) => {
  const ref = parsePlayerArgs(args);
  if (!ref) {
    await message.reply(messages.admin.playerUsage);
    return;
  }
  const resolved = await resolveRef(ref);
  if (!resolved.ok) {
    await deliverPrivate(message, failureLines(resolved));
    return;
  }

  const review = await getPlayerReview(resolved.player.id, mode);
  if (!review) {
    await deliverPrivate(message, [
      messages.admin.reviewPlayerNotFound(playerLabel(resolved.player)),
    ]);
    return;
  }

  const rawRate =
    review.gamesParticipated === 0 ? "—" : pct(review.gamesWon / review.gamesParticipated);
  const firstRate = review.firstGames === 0 ? "—" : pct(review.firstCorrect / review.firstGames);
  const lines = [
    messages.admin.playerSummary({
      name: review.displayName,
      discordUserId: review.discordUserId,
      wins: review.gamesWon,
      played: review.gamesParticipated,
      rawRate,
      shrunk: pct(review.shrunk),
      prior: pct(review.priorRate),
      firstCorrect: review.firstCorrect,
      firstGames: review.firstGames,
      firstRate,
      concentration: review.concentration.toFixed(2),
      created: accountLabel(review.discordCreatedAt),
    }),
    review.hosts.length === 0 ? messages.admin.playerNoWins : "",
    ...review.hosts.map((host) =>
      messages.admin.playerHostLine(
        host.displayName,
        host.discordUserId,
        host.wins,
        Math.max(review.winTotal, 1),
      ),
    ),
  ];
  await deliverPrivate(message, lines, mode);
};

const guessKind = (guess: {
  isCorrect: boolean;
  isRepeat: boolean;
  isRateLimited: boolean;
}): "correct" | "wrong" | "repeat" | "limited" => {
  if (guess.isRateLimited) {
    return "limited";
  }
  if (guess.isCorrect) {
    return "correct";
  }
  if (guess.isRepeat) {
    return "repeat";
  }
  return "wrong";
};

const gameCommand = async (message: Message, args: string[], requestedMode: GameMode) => {
  const id = args[0]?.trim() ?? "";
  if (args.length !== 1 || !UUID_PATTERN.test(id)) {
    await message.reply(messages.admin.gameUsage);
    return;
  }

  // Game ids are unique across modes, so look in the other mode when the first misses.
  const otherMode: GameMode = requestedMode === "province" ? "country" : "province";
  let mode = requestedMode;
  let game = await getGameReview(id, mode);
  if (!game) {
    mode = otherMode;
    game = await getGameReview(id, mode);
  }
  if (!game) {
    await deliverPrivate(message, [messages.admin.gameMissing]);
    return;
  }

  const winner = game.winnerName ? `**${game.winnerName}** (\`${game.winnerDiscordUserId}\`)` : "—";
  const country =
    mode === "province"
      ? `${game.countryCode} — ${getProvinceName(game.countryCode)}`
      : game.countryName
        ? `${game.countryCode} — ${game.countryName}`
        : game.countryCode;
  const lines = [
    messages.admin.gameHeader({
      id: game.id,
      status: game.status,
      source: messages.admin.reviewStartSource(game.startSource),
      gmName: game.gmName,
      gmDiscordUserId: game.gmDiscordUserId,
      winner,
      country,
      solve: secondsLabel(game.solveSeconds),
      median: secondsLabel(game.countryMedianSeconds),
      winnerWrong: game.winnerUniqueWrong == null ? "—" : String(game.winnerUniqueWrong),
      clockNote: game.usedStartFallback
        ? messages.admin.gameClockStart
        : messages.admin.gameClockAnnouncement,
      mode,
    }),
    game.guesses.length === 0 ? messages.admin.gameNoGuesses : "",
    ...game.guesses.map((guess) =>
      messages.admin.gameGuessLine({
        seconds: secondsLabel(guess.seconds),
        name: guess.displayName,
        raw: clip(guess.rawMessage),
        country: guess.countryCode ? targetLabel(mode, guess.countryCode) : "—",
        kind: messages.admin.gameGuessKind(guessKind(guess)),
      }),
    ),
    game.truncated ? messages.admin.gameTruncated : "",
  ];
  await deliverPrivate(message, lines, mode);
};

const fastCommand = async (message: Message, args: string[], mode: GameMode) => {
  if (args.length !== 1) {
    await message.reply(messages.admin.fastUsage);
    return;
  }
  const seconds = parseFastSeconds(args[0]);
  if (seconds === undefined) {
    await message.reply(messages.admin.fastUsage);
    return;
  }

  const wins = await listFastWins(seconds, mode);
  const lines = [
    wins.length === 0
      ? messages.admin.fastNone(seconds)
      : messages.admin.fastHeader(seconds, wins.length),
    ...wins.map((win) =>
      messages.admin.fastLine({
        solve: secondsLabel(win.solveSeconds),
        winnerName: win.winnerName,
        winnerDiscordUserId: win.winnerDiscordUserId,
        gmName: win.gmName,
        gmDiscordUserId: win.gmDiscordUserId,
        countryCode: targetLabel(mode, win.countryCode),
        median: secondsLabel(win.countryMedianSeconds),
        flags: flagList([
          ...(win.silent ? (["silent"] as const) : []),
          ...(win.dismissed ? (["cleared"] as const) : []),
        ]),
        gameId: win.gameId,
        mode,
      }),
    ),
  ];
  await deliverPrivate(message, lines, mode);
};

const winRatesCommand = async (message: Message, args: string[], mode: GameMode) => {
  if (args.length !== 0) {
    await message.reply(messages.admin.winRatesUsage);
    return;
  }

  const players = await getWinRateLeaderboard(mode);
  await deliverPrivate(
    message,
    [
      messages.admin.winRatesHeader,
      players.length === 0 ? messages.admin.winRatesNone : "",
      ...players.map((player, index) =>
        messages.admin.winRatesLine({
          rank: index + 1,
          name: clip(player.displayName),
          discordUserId: player.discordUserId,
          wins: player.wins,
          played: player.played,
          rate: `${(player.winRate * 100).toFixed(2)}%`,
        }),
      ),
    ],
    mode,
  );
};

const medalsCommand = async (message: Message, args: string[], mode: GameMode) => {
  const periodArg = normalize(args[0] ?? "");
  const allTime = !periodArg || ALL_TIME_ALIASES.has(periodArg);
  const periodType = allTime ? undefined : PERIOD_ALIASES[periodArg];
  if (args.length > 1 || (!allTime && !periodType)) {
    await message.reply(messages.admin.medalsUsage);
    return;
  }

  const rows = await getMedalLeaderboard(periodType, 25, mode);
  await deliverPrivate(
    message,
    [
      messages.admin.medalsHeader(messages.awards.medalsHeader(periodType)),
      rows.length === 0 ? messages.awards.noMedalData : "",
      ...rows.map((row, index) =>
        messages.admin.medalsLine({
          rank: index + 1,
          name: clip(row.displayName),
          discordUserId: row.discordUserId,
          medalPoints: row.medalPoints,
          gold: row.gold,
          silver: row.silver,
          bronze: row.bronze,
        }),
      ),
    ],
    mode,
  );
};

const dismissCommand = async (message: Message, args: string[]) => {
  const action = normalize(args[0] ?? "");
  if (!["pair", "cift"].includes(action)) {
    await message.reply(messages.admin.dismissUsage);
    return;
  }
  const resolved = await resolveTwo(message, args.slice(1), messages.admin.dismissUsage);
  if (!resolved) {
    return;
  }
  const result = await dismissReviewPair(resolved.left.id, resolved.right.id, message.author.id);
  const left = playerLabel(resolved.left);
  const right = playerLabel(resolved.right);
  await deliverPrivate(message, [
    result === "created"
      ? messages.admin.dismissDone(left, right)
      : messages.admin.dismissAlready(left, right),
  ]);
};

export const handleAdminReviewCommand = async (
  message: Message,
  subcommand: string,
  args: string[],
  mode: GameMode = "country",
) => {
  if (!REVIEW_COMMANDS.has(subcommand)) {
    return false;
  }

  if (["suspects", "supheli", "supheliler"].includes(subcommand)) {
    await suspectsCommand(message, args, mode);
    return true;
  }
  if (["pair", "cift"].includes(subcommand)) {
    await pairCommand(message, args, mode);
    return true;
  }
  if (["player", "oyuncu"].includes(subcommand)) {
    await playerCommand(message, args, mode);
    return true;
  }
  if (["profile", "profil"].includes(subcommand)) {
    await profileCommand(message, args, mode);
    return true;
  }
  if (["game", "oyun"].includes(subcommand)) {
    await gameCommand(message, args, mode);
    return true;
  }
  if (["fast", "hizli"].includes(subcommand)) {
    await fastCommand(message, args, mode);
    return true;
  }
  if (["winrates", "winrate", "galibiyet"].includes(subcommand)) {
    await winRatesCommand(message, args, mode);
    return true;
  }
  if (["medals", "madalya", "madalyalar"].includes(subcommand)) {
    await medalsCommand(message, args, mode);
    return true;
  }
  await dismissCommand(message, args);
  return true;
};
