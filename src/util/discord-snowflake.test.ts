import { describe, expect, test } from "bun:test";
import { discordSnowflakeToDate } from "./discord-snowflake.ts";

describe("discordSnowflakeToDate", () => {
  test("decodes a snowflake built from a known timestamp", () => {
    const timestamp = 1_700_000_000_000n;
    const id = ((timestamp - 1_420_070_400_000n) << 22n).toString();
    expect(discordSnowflakeToDate(id)?.getTime()).toBe(Number(timestamp));
  });

  test("rejects blank, non-numeric, and oversized ids", () => {
    expect(discordSnowflakeToDate("")).toBeUndefined();
    expect(discordSnowflakeToDate("not-an-id")).toBeUndefined();
    expect(discordSnowflakeToDate("9999999999999999999")).toBeUndefined();
  });
});
