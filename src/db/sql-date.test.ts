import { afterAll, describe, expect, test } from "bun:test";
import { closeDatabase, sqlClient } from "./client.ts";

describe("sql date parameters", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  test("binds a Date on the shared client after Drizzle installs its serializers", async () => {
    const when = new Date("2017-03-17T11:41:58.481Z");

    const stored = await sqlClient
      .begin(async (tx) => {
        const inserted = await tx`
        INSERT INTO player (discord_user_id, display_name, discord_created_at, last_seen_at, updated_at)
        VALUES (${"debug-date-param"}, ${"date-param"}, ${when}, now(), now())
        RETURNING discord_created_at
      `;
        await tx`UPDATE game SET announced_at = ${when} WHERE false`;
        await tx`UPDATE guess SET sent_at = ${when} WHERE false`;
        throw Object.assign(new Error("rollback"), { stored: inserted[0]?.discord_created_at });
      })
      .catch((error: { message?: string; stored?: unknown }) => {
        if (error?.message !== "rollback") {
          throw error;
        }
        return error.stored;
      });

    expect(new Date(stored as string | Date).toISOString()).toBe(when.toISOString());
  });
});
