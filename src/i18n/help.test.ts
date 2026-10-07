import { expect, test } from "bun:test";
import { enMessages } from "./en.ts";
import { trMessages } from "./tr.ts";

// `!help` sends one message, with the test commands appended for test admins.
for (const catalog of [enMessages, trMessages]) {
  test(`${catalog.locale} player help fits Discord's 2,000-character message limit`, () => {
    for (const help of [catalog.commands.helpCommands, catalog.province.helpCommands]) {
      expect(`${help}\n${catalog.commands.helpTestCommands}`.length).toBeLessThanOrEqual(2_000);
    }
  });
}
