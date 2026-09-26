# location-guessing-game

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

Database commands:

```bash
bun run db:generate
bun run db:migrate
bun run db:studio
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Province mode (Türkiye)

A second game where players guess one of Türkiye's 81 provinces. It runs in its own
channel, at the same time as the country game, and keeps its own tables
(`province_*`) for games, stats, medals, and achievements.

- Set the channel with `DISCORD_PROVINCE_GAME_CHANNEL_ID`. On startup the bot copies it to
  `rule.province_game_channel_id` if that column is empty. Province mode is off while it is empty.
- A link and screenshot posted in the province channel start a province game.
- A DM start in Türkiye gets two buttons: country game or province game. Other DM starts
  begin a country game as before.
- Guess with the province name (`Şanlıurfa`, `sanliurfa`, `urfa`) or the plate code (`63`).
- Stats commands in the province channel show province data. Elsewhere, add `il`
  (for example `!profile il`). Admin commands take `il` after `!admin` (for example `!admin il status`).
- Province test mode: set `rule.province_test_channel_id` and turn on test mode. See
  `DISCORD_TEST_CHANNEL_SETUP.md`.
- Province shapes come from Natural Earth admin-1 (public domain), simplified with mapshaper
  (`src/domain/provinces/tr-provinces.topo.json`).
