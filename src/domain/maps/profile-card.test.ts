import { describe, expect, test } from "bun:test";
import { loadImage } from "@napi-rs/canvas";
import {
  PROFILE_CARD_LAYOUTS,
  PROFILE_TILE_STYLES,
  renderProfileCard,
  type ProfileCardInput,
  type ProfileCardLayout,
  type ProfileTileStyle,
} from "./profile-card.ts";
import { PLAYER_NAME_TIER_THRESHOLDS } from "./player-name-style.ts";
import { MAP_RESOLUTION_SCALE } from "./region-presets.ts";

const baseInput: ProfileCardInput = {
  mode: "country",
  playerName: "Şanlıurfa Çağrı ".repeat(6),
  points: 21384,
  wins: 141,
  participated: 344,
  gamesStarted: 105,
  guesses: 1919,
  gmMultiplier: 2.1,
  medals: { gold: 0, silver: 0, bronze: 0 },
  achievementsUnlocked: 91,
  stamps: [
    { code: "TR", name: "TÜRKİYE", count: 31, coordinates: [35.4, 39.1] },
    { code: "BR", name: "BREZİLYA", count: 12, coordinates: [-52, -10.5] },
  ],
};

/** One medal mix at the bottom of each tier, as bronze medals worth one point each. */
const tierInputs = PLAYER_NAME_TIER_THRESHOLDS.map(([tier, minimum]) => ({
  tier,
  input: { ...baseInput, medals: { gold: 0, silver: 0, bronze: minimum } },
}));

const decode = async (buffer: Buffer) => {
  expect(Array.from(buffer.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  return loadImage(buffer);
};

describe("profile card", () => {
  const layouts = Object.keys(PROFILE_CARD_LAYOUTS) as ProfileCardLayout[];
  test.each(layouts)(
    "%s renders every tier at full resolution with a long name",
    async (layout) => {
      for (const { input } of tierInputs) {
        const image = await decode(renderProfileCard(input, layout).buffer);
        expect(image.width).toBe(960 * MAP_RESOLUTION_SCALE);
        expect(image.height).toBe(PROFILE_CARD_LAYOUTS[layout].height * MAP_RESOLUTION_SCALE);
      }
    },
    30_000,
  );

  test("every tile style gives a different card", () => {
    const styles = Object.keys(PROFILE_TILE_STYLES) as ProfileTileStyle[];
    const topTier = tierInputs.at(-1)!.input;
    const hashes = new Set(
      styles.map((style) => Bun.hash(renderProfileCard(topTier, "banner", style).buffer)),
    );
    expect(hashes.size).toBe(styles.length);
  });

  test("renders without an avatar, stamps or any games", async () => {
    const card = renderProfileCard({
      ...baseInput,
      mode: "province",
      playerName: "",
      wins: 0,
      participated: 0,
      stamps: [],
    });
    await decode(card.buffer);
    expect(card.filename).toBe("profile-province.png");
  });
});
