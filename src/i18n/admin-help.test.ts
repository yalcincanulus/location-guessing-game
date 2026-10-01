import { expect, test } from "bun:test";
import { enMessages } from "./en.ts";
import { trMessages } from "./tr.ts";

// Both !admin and !admin help reply with this text directly.
for (const catalog of [enMessages, trMessages]) {
  test(`${catalog.locale} admin help fits Discord's 2,000-character message limit`, () => {
    expect(catalog.admin.help.length).toBeLessThanOrEqual(2_000);
  });
}
