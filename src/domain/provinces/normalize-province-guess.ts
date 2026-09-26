import { provinces } from "./province-data.ts";

export type ParsedProvinceGuess = {
  provinceCode: string;
  displayName: string;
  strategy: "plate" | "alias";
};

export const normalizeProvinceName = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    // Same folding as country guesses: "I" → "ı" under the tr locale, so fold ı to i.
    .replaceAll("ı", "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Ankara ili" and "Ankara province" mean the same as "Ankara". */
const SUFFIXES = [" ili", " province", " sehri"];

const aliases = new Map<string, ParsedProvinceGuess>();
const namesByCode = new Map<string, string>();

for (const province of provinces) {
  const parsed: ParsedProvinceGuess = {
    provinceCode: province.code,
    displayName: province.name,
    strategy: "alias",
  };
  namesByCode.set(province.code, province.name);
  for (const name of [province.name, ...(province.aliases ?? [])]) {
    const key = normalizeProvinceName(name);
    aliases.set(key, parsed);
    aliases.set(key.replace(/\s+/g, ""), parsed);
  }
}

const parsePlateCode = (value: string): ParsedProvinceGuess | undefined => {
  if (!/^\d{1,2}$/.test(value)) {
    return undefined;
  }
  const code = value.padStart(2, "0");
  const name = namesByCode.get(code);
  return name ? { provinceCode: code, displayName: name, strategy: "plate" } : undefined;
};

const parseSingleGuess = (message: string): ParsedProvinceGuess | undefined => {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 64) {
    return undefined;
  }

  const normalized = normalizeProvinceName(trimmed);
  if (!normalized) {
    return undefined;
  }

  const byPlate = parsePlateCode(normalized);
  if (byPlate) {
    return byPlate;
  }

  const direct = aliases.get(normalized) ?? aliases.get(normalized.replace(/\s+/g, ""));
  if (direct) {
    return direct;
  }

  for (const suffix of SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      const stem = normalized.slice(0, -suffix.length);
      const bySuffix = aliases.get(stem) ?? aliases.get(stem.replace(/\s+/g, ""));
      if (bySuffix) {
        return bySuffix;
      }
    }
  }

  return undefined;
};

export const normalizeProvinceGuess = (message: string): ParsedProvinceGuess | undefined => {
  const trimmed = message.trim();
  if (!trimmed) {
    return undefined;
  }

  const direct = parseSingleGuess(trimmed);
  if (direct) {
    return direct;
  }

  // Multi-line messages: accept the first line that is a valid province guess.
  for (const line of trimmed.split(/\r?\n/)) {
    const parsed = parseSingleGuess(line);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
};

export const isKnownProvinceCode = (code: string) => namesByCode.has(code);

export const getProvinceName = (code: string) => namesByCode.get(code) ?? code;

/** Looks up a province by any accepted spelling of its name. */
export const findProvinceByName = (name: string) => {
  const normalized = normalizeProvinceName(name);
  return aliases.get(normalized) ?? aliases.get(normalized.replace(/\s+/g, ""));
};
