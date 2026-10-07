import { afterAll, describe, expect, test } from "bun:test";
import postgres from "postgres";
import { env } from "../config/env.ts";
import { getPlayerMapHistory } from "./player-map-repository.ts";
import { tablesFor, type GameMode } from "../domain/game/game-mode.ts";

const testSql = postgres(env.databaseUrl, { max: 1, onnotice: () => undefined });

describe("player map history", () => {
  afterAll(async () => {
    await testSql.end({ timeout: 5 });
  });

  test.each<GameMode>(["country", "province"])(
    "%s maps use the player's finished, non-test history",
    async (mode) => {
      const rollback = new Error("rollback map fixtures");
      try {
        await testSql.begin(async (sql) => {
          const discordUserId = `map-test-${crypto.randomUUID()}`;
          const subject = crypto.randomUUID();
          const other = crypto.randomUUID();
          await sql`
            INSERT INTO player (id, discord_user_id, display_name)
            VALUES (${subject}, ${discordUserId}, 'Map player'),
                   (${other}, ${`${discordUserId}-other`}, 'Other player')
          `;

          const fixtures = [
            { country: "FR", province: "06", host: other, winner: subject, status: "completed" },
            { country: "FR", province: "06", host: other, winner: subject, status: "completed" },
            { country: "DE", province: "34", host: subject, winner: other, status: "completed" },
            { country: "FR", province: "06", host: subject, winner: subject, status: "completed" },
            { country: "JP", province: "35", host: subject, winner: subject, status: "cancelled" },
            { country: "AU", province: "42", host: subject, winner: subject, status: "failed" },
            { country: "BR", province: "07", host: subject, winner: subject, status: "active" },
            {
              country: "ES",
              province: "16",
              host: subject,
              winner: subject,
              status: "completed",
              isTest: true,
            },
            { country: "US", province: "01", host: other, winner: other, status: "completed" },
          ];
          for (const fixture of fixtures) {
            const locationId = crypto.randomUUID();
            await sql`
              INSERT INTO location (
                id, original_google_maps_url, latitude, longitude, coordinate_source,
                country_code, manual_country_code
              ) VALUES (
                ${locationId}, 'https://maps.google.com/?q=0,0', 0, 0, 'test',
                ${fixture.country === "FR" ? "GB" : fixture.country},
                ${fixture.country === "FR" ? "FR" : null}
              )
            `;
            const provinceColumn = mode === "province" ? sql`, target_province_code` : sql``;
            const provinceValue = mode === "province" ? sql`, ${fixture.province}` : sql``;
            await sql`
              INSERT INTO ${sql(tablesFor(mode).game)} (
                game_master_player_id, winner_player_id, location_id, status, screenshot_url,
                is_test ${provinceColumn}
              ) VALUES (
                ${fixture.host}, ${fixture.winner}, ${locationId}, ${fixture.status},
                'https://example.com/screenshot.jpg', ${fixture.isTest ?? false} ${provinceValue}
              )
            `;
          }

          expect(await getPlayerMapHistory(discordUserId, "wins", mode, sql)).toEqual({
            locationCodes: mode === "country" ? ["FR"] : ["06"],
            gameCount: 3,
            topLocations: [{ code: mode === "country" ? "FR" : "06", count: 3 }],
          });
          expect(await getPlayerMapHistory(discordUserId, "starts", mode, sql)).toEqual({
            locationCodes: mode === "country" ? ["AU", "DE", "FR", "JP"] : ["06", "34", "35", "42"],
            gameCount: 4,
            topLocations: (mode === "country"
              ? ["AU", "DE", "FR", "JP"]
              : ["06", "34", "35", "42"]
            ).map((code) => ({ code, count: 1 })),
          });
          expect(
            await getPlayerMapHistory(
              discordUserId,
              "wins",
              mode === "country" ? "province" : "country",
              sql,
            ),
          ).toEqual({
            locationCodes: [],
            gameCount: 0,
            topLocations: [],
          });
          expect(
            await getPlayerMapHistory(`${discordUserId}-missing`, "starts", mode, sql),
          ).toEqual({
            locationCodes: [],
            gameCount: 0,
            topLocations: [],
          });
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) {
          throw error;
        }
      }
    },
  );
});
