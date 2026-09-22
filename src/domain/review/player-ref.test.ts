import { describe, expect, test } from "bun:test";
import { parsePlayerArgs, parsePlayerToken } from "./player-ref.ts";

describe("parsePlayerToken", () => {
  test("accepts a mention, an id, or a display name", () => {
    expect(parsePlayerToken("<@12345678901234567>")).toEqual({
      kind: "id",
      discordUserId: "12345678901234567",
    });
    expect(parsePlayerToken("<@!12345678901234567>")).toEqual({
      kind: "id",
      discordUserId: "12345678901234567",
    });
    expect(parsePlayerToken("123456789012345678")).toEqual({
      kind: "id",
      discordUserId: "123456789012345678",
    });
    expect(parsePlayerToken("Ada")).toEqual({ kind: "name", displayName: "Ada" });
  });
});

describe("parsePlayerArgs", () => {
  test("joins a multi-word display name and rejects junk after an id", () => {
    expect(parsePlayerArgs(["Ada", "Lovelace"])).toEqual({
      kind: "name",
      displayName: "Ada Lovelace",
    });
    expect(parsePlayerArgs(["12345678901234567", "extra"])).toBeUndefined();
  });
});
