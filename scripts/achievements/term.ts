/** Tiny ANSI helpers for local sim CLIs. Respects NO_COLOR / non-TTY. */

const enabled =
  !Bun.env.NO_COLOR &&
  Bun.env.TERM !== "dumb" &&
  (typeof process.stdout?.isTTY === "boolean" ? process.stdout.isTTY : true);

const wrap = (code: string, text: string) => (enabled ? `\x1b[${code}m${text}\x1b[0m` : text);

export const color = {
  bold: (text: string) => wrap("1", text),
  dim: (text: string) => wrap("2", text),
  green: (text: string) => wrap("32", text),
  red: (text: string) => wrap("31", text),
  yellow: (text: string) => wrap("33", text),
  cyan: (text: string) => wrap("36", text),
  magenta: (text: string) => wrap("35", text),
  gray: (text: string) => wrap("90", text),
};

export const formatUnlock = (achievementId: string, tier: number) =>
  `${color.cyan(achievementId)}${color.dim("@")}${color.yellow(String(tier))}`;
