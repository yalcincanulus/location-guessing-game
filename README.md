# 🌍 Location Guessing Game

A multiplayer location guessing game that runs inside Discord. One player hosts a round with a Google Maps link and a screenshot. Everyone else races to name the country (or Turkish province) in chat. The first correct guess wins.

The bot handles the whole round: it finds the answer from the link, hides the link from players, checks guesses, keeps score, and draws a map of every wrong guess when the round ends.

Join [GeoGuessr Türkiye](https://www.geoturkiye.community/) to play this game.

## Features

### Gameplay

- **Guess in plain chat.** No slash commands. Type `Netherlands`, `NL`, `NLD`, `Hollanda`, or `holland`. The bot reacts with ✅ for a correct guess, ❌ for a wrong one, and 🔄 for a country someone already tried.
- **English and Turkish** country names, ISO codes, and common aliases are all accepted.
- **Automatic answers.** The bot reads coordinates from all common Google Maps URL formats, including short links. It finds the country with Nominatim (OpenStreetMap) reverse geocoding.
- **Flexible starts.** Send the link and the screenshot by DM, in the channel, or one in each place, in any order.
- **Wrong-guess maps.** At the end of a round, the bot draws a map with wrong guesses in red and the answer in green. Players can also ask for the current map during a round, zoomed to a region such as `!europe` or `!asia`.
- **Sharp map images.** All maps use lossless PNG at twice the base resolution to preserve borders, text, and colors without JPEG artifacts.

### 🇹🇷 Province mode

A second game where players guess one of Türkiye's 81 provinces. It runs in its own channel, at the same time as the country game, with separate stats, medals, and achievements.

- Guess with the province name (`Şanlıurfa`, `sanliurfa`, `urfa`) or the plate code (`63`).
- A DM start inside Türkiye asks the host to pick the country game or the province game.
- Province maps are drawn from Natural Earth admin-1 boundaries.

### Scoring and competition

- **Points with multipliers.** A win is worth base points × a round multiplier × the host's multiplier.
  - The **round multiplier** grows while a round stays unsolved, so hard rounds pay more.
  - The **host multiplier** grows each time a host's round reaches a new wrong-guess milestone (10, 20, … 200). This rewards hosts who pick hard locations.
- **Leaderboards and profiles** with `!leaderboard`, `!profile`, `!hardest`, and `!stats`.
- **Personal maps.** `!winmap` shows the countries or provinces where you won in gold. `!startmap` shows where you started finished rounds in violet. Each image includes your name, medal counts, the game mode, totals, and the creation date in Istanbul time. Both commands use all recorded history and exclude test games.

  Start maps include completed, cancelled, and failed rounds, and hide active rounds to protect the answer. The channel selects the mode. An explicit mode argument overrides the channel, such as `!winmap province` or `!startmap country`. Both commands also work in DM, where the default mode is country.

  Name colors use the total medal count for the selected mode. White covers 0–24 medals, gold 25–149, rose-plum 150–299, and platinum blue 300–399. The explorer tier starts at 400 medals, with iridescent mint lettering and four sparkles.

  Explorer headers use Atlas, with a geography background, world silhouette, and compass rose. All designs remain available in `src/domain/maps/player-map-header-designs.ts`: Atlas, Nautical, Aurora, Pixel Atlas, and Pixel Voyager. Set `activePlayerMapHeaderDesign` to switch designs. Lower tiers always keep the plain header.

  Run `bun run preview:player-maps` to render every design for both commands and modes in `.cache/player-map-headers`.

- **Period awards.** Daily, weekly, monthly, seasonal, and yearly standings for most points, most wins, most games started, and best game master. Gold, silver, and bronze medals go to the top three when each period ends.
- **Achievements.** More than 30 achievements across a **host** track and a **guesser** track. They include tier ladders, streaks, geography goals, and rare one-time moments. Players view them with `!achievements`.

### Moderation and admin tools

- **Collusion review.** `!admin suspects` flags player pairs who win unusually often against each other, fast solves, and host-only accounts. Follow-up commands show the full history for a player, a pair, or a game.
- **Fair play notices.** Screenshots include a small, single-line request addressed to AI and an image metadata notice. After each new round announcement, the bot also sends a friendly reminder for players as a separate message. These notices cannot prevent AI assistance. The database rule `fair_play_notice_enabled` controls all three notices in both game modes and defaults to `true`. Use `!admin fairplay` to show its status, or `!admin fairplay on` / `off` to change it immediately. `!ss` also adds the image notices to older screenshots without duplicating an existing footer. Disabling notices does not remove a footer already saved in an image.
- **Test mode.** A private test channel where admins can run rounds without affecting real stats.
- **Player feedback.** Players send `!feedback <message>` by DM, with rate limiting.
- **Idle reminders.** The bot posts a reminder in the channel at set hours when nobody has started a round.

### Localization

All bot messages are available in **English** and **Turkish**. Set the language with `BOT_LOCALE`. Commands accept both languages (for example `!profile` / `!profil`, `!medals` / `!madalya`).

## Tech stack

| Area            | Tools                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime         | [Bun](https://bun.com), compiled to a single binary for production                                                                      |
| Language        | TypeScript                                                                                                                              |
| Discord         | [discord.js](https://discord.js.org) v14                                                                                                |
| Database        | PostgreSQL with [Drizzle ORM](https://orm.drizzle.team) v1 and Drizzle Kit migrations                                                   |
| Live game state | Redis                                                                                                                                   |
| Scheduled jobs  | [BullMQ](https://bullmq.io) (multiplier ticks, start reservations, period awards, achievement streaks, idle reminders)                  |
| Map rendering   | [d3-geo](https://d3js.org/d3-geo), [topojson-client](https://github.com/topojson/topojson-client), `world-atlas`, and `@napi-rs/canvas` |
| Geocoding       | [Nominatim](https://nominatim.org) (OpenStreetMap)                                                                                      |
| Tooling         | `bun test`, [oxlint](https://oxc.rs/docs/guide/usage/linter), oxfmt                                                                     |
| Deployment      | Docker and Docker Compose (Coolify-ready), with Drizzle Gateway for database access                                                     |

## Getting started

### Requirements

- Bun 1.4 or later
- Docker (for PostgreSQL and Redis), or your own PostgreSQL and Redis servers
- A Discord bot application with the **Message Content** intent enabled

### Local setup

```bash
# 1. Install dependencies
bun install

# 2. Create your environment file and fill in the values
cp .env.example .env

# 3. Start PostgreSQL and Redis
docker compose up -d postgres redis

# 4. Run database migrations
bun run db:migrate

# 5. Start the bot in watch mode
bun run start
```

When the bot runs outside Docker, set `DATABASE_URL` and `REDIS_URL` in `.env` so they point at your local services. See `.env.example` for all variables.

### Main environment variables

| Variable                           | Purpose                                            |
| ---------------------------------- | -------------------------------------------------- |
| `DISCORD_TOKEN`                    | Bot token                                          |
| `DISCORD_CLIENT_ID`                | Discord application ID                             |
| `DISCORD_GUILD_ID`                 | Server the bot runs in                             |
| `DISCORD_ADMIN_USER_ID`            | User who can run admin commands                    |
| `DISCORD_GAME_CHANNEL_ID`          | Channel for the country game                       |
| `DISCORD_PROVINCE_GAME_CHANNEL_ID` | Channel for province mode (optional)               |
| `DISCORD_LOG_CHANNEL_ID`           | Channel for bot logs (optional)                    |
| `NOMINATIM_USER_AGENT`             | Identifying user agent for Nominatim, with contact |
| `BOT_LOCALE`                       | `en` or `tr`                                       |

Game rules such as base points, multiplier caps, and the consecutive guess limit are stored in the `rule` table. Admins can reload them at runtime with `!admin reload`.

### Deployment

```bash
docker compose up -d --build
```

This starts PostgreSQL, Redis, the bot, and Drizzle Gateway. The bot image is a compiled Bun binary on Alpine.

## Project structure

```text
src/
├── bot/            Discord client, events, and permissions
├── commands/       Player, admin, test, and feedback commands
├── config/         Environment and rule loading
├── db/             Drizzle schema, relations, and migrations
├── domain/
│   ├── game/          Round lifecycle, guess parsing, scoring, rate limits
│   ├── countries/     Country names, aliases, and normalization
│   ├── provinces/     Turkish provinces, plate codes, and geometry
│   ├── geocoding/     Google Maps parsing and Nominatim lookup
│   ├── maps/          Map rendering, themes, and region presets
│   ├── awards/        Period standings and medals
│   ├── achievements/  Achievement catalog and evaluation
│   └── review/        Collusion review scoring
├── i18n/           English and Turkish messages
├── jobs/           BullMQ queues and schedules
├── redis/          Redis client and keys
└── repositories/   Database queries
```

## Credits

- Map data from [Natural Earth](https://www.naturalearthdata.com) (public domain) through `world-atlas`.
- Reverse geocoding by [Nominatim](https://nominatim.org), with data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
