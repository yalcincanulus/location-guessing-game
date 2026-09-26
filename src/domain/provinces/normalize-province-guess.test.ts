import { describe, expect, test } from "bun:test";
import { provinces } from "./province-data.ts";
import { normalizeProvinceGuess, normalizeProvinceName } from "./normalize-province-guess.ts";
import { provinceFeatures } from "./province-geometry.ts";

describe("province data", () => {
  test("has 81 provinces with unique plate codes 01–81", () => {
    const codes = provinces.map((province) => province.code);
    expect(new Set(codes).size).toBe(81);
    expect(codes).toEqual(
      Array.from({ length: 81 }, (_, index) => String(index + 1).padStart(2, "0")),
    );
  });

  test("every province has a map shape and every shape is a province", () => {
    expect(provinceFeatures.map((entry) => entry.id).sort()).toEqual(
      provinces.map((province) => province.code),
    );
  });

  test("no two provinces share a name or alias", () => {
    const seen = new Map<string, string>();
    for (const province of provinces) {
      for (const name of [province.name, ...(province.aliases ?? [])]) {
        const key = normalizeProvinceName(name);
        const owner = seen.get(key);
        expect(owner === undefined || owner === province.code).toBe(true);
        seen.set(key, province.code);
      }
    }
  });
});

describe("normalizeProvinceGuess", () => {
  test("accepts Turkish names with or without Turkish letters", () => {
    for (const guess of ["İstanbul", "istanbul", "ISTANBUL", "İSTANBUL"]) {
      expect(normalizeProvinceGuess(guess)?.provinceCode).toBe("34");
    }
    for (const guess of ["Şanlıurfa", "sanliurfa", "SANLIURFA", "urfa"]) {
      expect(normalizeProvinceGuess(guess)?.provinceCode).toBe("63");
    }
    for (const guess of ["Iğdır", "igdir", "IĞDIR"]) {
      expect(normalizeProvinceGuess(guess)?.provinceCode).toBe("76");
    }
    expect(normalizeProvinceGuess("Kırıkkale")?.provinceCode).toBe("71");
    expect(normalizeProvinceGuess("kirklareli")?.provinceCode).toBe("39");
  });

  test("accepts plate codes with or without a leading zero", () => {
    expect(normalizeProvinceGuess("06")).toMatchObject({ provinceCode: "06", strategy: "plate" });
    expect(normalizeProvinceGuess("6")?.provinceCode).toBe("06");
    expect(normalizeProvinceGuess("81")?.provinceCode).toBe("81");
    expect(normalizeProvinceGuess("0")).toBeUndefined();
    expect(normalizeProvinceGuess("82")).toBeUndefined();
    expect(normalizeProvinceGuess("100")).toBeUndefined();
  });

  test("accepts common short names and suffixes", () => {
    expect(normalizeProvinceGuess("antep")?.provinceCode).toBe("27");
    expect(normalizeProvinceGuess("maraş")?.provinceCode).toBe("46");
    expect(normalizeProvinceGuess("K. Maraş")?.provinceCode).toBe("46");
    expect(normalizeProvinceGuess("afyon")?.provinceCode).toBe("03");
    expect(normalizeProvinceGuess("İçel")?.provinceCode).toBe("33");
    expect(normalizeProvinceGuess("Ankara ili")?.provinceCode).toBe("06");
    expect(normalizeProvinceGuess("afyon karahisar")?.provinceCode).toBe("03");
  });

  test("returns the official name", () => {
    expect(normalizeProvinceGuess("izmir")?.displayName).toBe("İzmir");
  });

  test("accepts the first valid line of a multi-line message", () => {
    expect(normalizeProvinceGuess("hmm\nkonya")?.provinceCode).toBe("42");
  });

  test("ignores chat and country names", () => {
    expect(normalizeProvinceGuess("bence doğudadır")).toBeUndefined();
    expect(normalizeProvinceGuess("germany")).toBeUndefined();
    expect(normalizeProvinceGuess("")).toBeUndefined();
  });
});
