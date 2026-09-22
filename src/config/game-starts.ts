const normalizeToken = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

const OPEN = new Set(["on", "ac", "open", "enable", "enabled"]);
const CLOSED = new Set([
  "off",
  "kapat",
  "kapa",
  "kapali",
  "close",
  "closed",
  "disable",
  "disabled",
]);

/** `true` opens new game starts, `false` closes them. */
export const parseGameStartsEnabled = (value: string): boolean | undefined => {
  const token = normalizeToken(value);
  if (OPEN.has(token)) {
    return true;
  }
  if (CLOSED.has(token)) {
    return false;
  }
  return undefined;
};
