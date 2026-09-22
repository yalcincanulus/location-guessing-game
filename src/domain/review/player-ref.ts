export type PlayerRef =
  | { kind: "id"; discordUserId: string }
  | { kind: "name"; displayName: string };

const MENTION = /^<@!?(\d+)>$/;

export const parsePlayerToken = (token: string): PlayerRef | undefined => {
  const trimmed = token.trim();
  if (!trimmed) {
    return undefined;
  }

  const mention = trimmed.match(MENTION);
  if (mention?.[1]) {
    return { kind: "id", discordUserId: mention[1] };
  }
  if (/^\d{15,22}$/.test(trimmed)) {
    return { kind: "id", discordUserId: trimmed };
  }
  return { kind: "name", displayName: trimmed };
};

/** One player. Several words are a display name, unless the first token is an id. */
export const parsePlayerArgs = (args: string[]): PlayerRef | undefined => {
  if (args.length === 0) {
    return undefined;
  }

  const first = parsePlayerToken(args[0] ?? "");
  if (!first) {
    return undefined;
  }
  if (args.length === 1) {
    return first;
  }
  if (first.kind === "id") {
    return undefined;
  }
  return { kind: "name", displayName: args.join(" ").trim() };
};
