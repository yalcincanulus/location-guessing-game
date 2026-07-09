# Discord Location Guessing Game - Project Plan

This document is the implementation roadmap for the multiplayer Discord location guessing game. It is intentionally checkbox-driven so future agents and maintainers can mark progress, add detail, and split work without losing the original product requirements.

## Current Status

- [x] Project planning complete
- [x] Architecture implemented
- [x] Database schema implemented
- [x] Discord bot runtime implemented
- [x] Game lifecycle implemented
- [x] Guess parsing implemented
- [x] Map rendering implemented
- [x] Stats and leaderboards implemented
- [ ] Tests implemented
- [ ] Deployment documented



## Implementation Notes

- [x] `bun run check` passes.
- [x] Database migration was verified successfully against the running Docker Postgres instance by overriding the host port to `6432`.
- [ ] `.env` currently points `DATABASE_URL` at port `5432`, but the detected Docker port mapping is `6432->5432`. Normal app startup needs `DATABASE_URL` corrected to port `6432` unless the Postgres mapping changes.
- [ ] Discord runtime was not live-tested because `DISCORD_TOKEN` and `DISCORD_GAME_CHANNEL_ID` are not currently present in `.env`.
- [ ] Map rendering currently outputs SVG attachments generated from `world-atlas`, `topojson-client`, and `d3-geo`. If strict PNG output is required, add an SVG-to-PNG rasterization step compatible with Bun deployment.



## Confirmed Stack

- Runtime: Bun
- Language: TypeScript release candidate
- Discord client: `discord.js`
- Main database: PostgreSQL
- ORM and migrations: Drizzle ORM v1 release candidate and Drizzle Kit v1 release candidate
- Cache and active-game state: Redis
- Job scheduling: BullMQ
- Map rendering: `d3-geo`, `topojson-client`, `world-atlas`
- Image processing: `Bun.Image` / Bun image pipeline where needed, not Sharp



## Source Notes

- Nominatim reverse geocoding endpoint is `https://nominatim.openstreetmap.org/reverse?lat=<value>&lon=<value>&<params>`. Use WGS84 latitude and longitude, request JSON, and read `address.country_code` where available.
- Nominatim reverse geocoding returns the closest suitable OSM object, not necessarily the exact coordinate address. The implementation should store raw response metadata for debugging and support manual correction.
- Nominatim public API requests should include an identifying `User-Agent` and, for larger deployments, an `email` query parameter or equivalent contact configuration.
- Drizzle ORM v1 removes RQB v1 and uses the new relations API through `defineRelations()`.
- Drizzle ORM v1 casing is table/view/schema-level. Prefer `snakeCase.table(...)` for PostgreSQL tables so TypeScript can use camelCase field names while SQL remains snake_case.
- Drizzle Kit v1 migration layout changed. Do not assume old `journal.json` migration behavior.
- Bun image APIs are a chainable native pipeline for decoding, resizing, transforming, and encoding common image formats. Use this when image composition or output conversion needs native image work.



## Product Scope



### Core Game Loop

- [ ] A verified game master starts a round by submitting a Google Maps link and a screenshot.
- [ ] The bot extracts latitude and longitude from the Google Maps link.
- [ ] The bot reverse geocodes the coordinate through Nominatim.
- [ ] The bot determines the target country and region.
- [ ] The bot posts the screenshot in the game channel and announces the new game.
- [ ] Verified players guess by sending normal messages, not special guess commands.
- [ ] The bot reacts immediately to valid guesses:
  - [ ] Wrong guess: `❌`
  - [ ] Correct guess: `✅`
  - [ ] Repeated wrong country: `🔄`
- [ ] The game ends on the first correct guess.
- [ ] The bot announces the winner and point calculation.
- [ ] The bot posts the final wrong-guesses map with wrong countries in red and the correct country in green.
- [ ] A new game can start after the current game ends.



### Access Rules

- [ ] Only users with the configured player role, for example `verified`, can start games.
- [ ] Only users with the configured player role can make guesses.
- [ ] The game master who started the current game cannot guess in that game.
- [ ] Bot messages are ignored.
- [ ] Messages from unverified users are ignored or optionally deleted/configurable.
- [ ] Role names and role IDs are configurable through database rules and/or environment defaults.



### Consecutive Guess Limit

- [ ] Consecutive guesses per player are limited by configurable rule, for example `6`.
- [ ] Once a player hits the consecutive limit, additional guesses from that player are ignored or reacted to with a configurable feedback emoji.
- [ ] Guesses from other players reduce or clear the blocked player's consecutive streak according to configured behavior.
- [ ] If no guesses are made for the configured idle reset duration, for example `30 minutes`, consecutive guess limits are cleared.
- [ ] Rate-limit state is held in Redis for the active game and persisted enough in Postgres to audit behavior.



## Game Starting Workflows



### Method 1: Direct Message Start

- [ ] A verified user can DM the bot a message containing both a Google Maps link and image attachment.
- [ ] A verified user can DM the link first and the screenshot later.
- [ ] A verified user can DM the screenshot first and the link later.
- [ ] Pending DM submissions are tracked by user and expire after a configurable timeout.
- [ ] Once both link and screenshot exist, the bot starts the game in the configured game channel if no game is active.
- [ ] If a game is already active, the bot keeps or rejects the pending submission according to configured queue policy.



### Method 2: Channel Start

- [ ] When no active game exists, the bot detects a Google Maps link in the game channel.
- [ ] The bot deletes the link message immediately to prevent players from opening it.
- [ ] The bot begins location extraction and reverse geocoding immediately.
- [ ] The same user can then send the screenshot in the game channel.
- [ ] The bot deletes the screenshot message after capturing the Discord attachment URL.
- [ ] Once both link and screenshot exist, the bot starts the game.



### Hybrid Start

- [ ] If a user sends the Google Maps link in the channel, they can complete the submission with a screenshot by DM.
- [ ] If a user sends the screenshot by DM, they can complete the submission with a link to the channel. Bot will delete the link from the channel immediately to prevent players from opening it.
- [ ] Pending hybrid submissions are scoped by guild, channel, and user.
- [ ] Expired pending starts are cleaned from Redis and optionally logged to Postgres.



### Start Validation

- [ ] Reject starts from unverified users.
- [ ] Reject starts when link coordinates cannot be extracted.
- [ ] Reject starts when reverse geocoding does not return a country code.
- [ ] Reject starts without an image attachment.
- [ ] Reject starts outside configured game channel unless DM workflow is being used.
- [ ] Reject or queue starts when a game is already active, based on configured rule.
- [ ] Log failed start attempts for debugging and future moderation features.



## Google Maps Link Parsing

- [ ] Support common Google Maps URL forms:
  - [ ] `https://www.google.com/maps/@lat,lon,zoom`
  - [ ] `https://maps.google.com/...`
  - [ ] `https://goo.gl/maps/...` and other shortened links after following redirects
  - [ ] URLs containing `!3d<lat>!4d<lon>`
  - [ ] URLs containing query params such as `q=lat,lon`
- [ ] Follow redirects with a safe timeout and max redirect count.
- [ ] Extract coordinates with structured URL parsing before regex fallback.
- [ ] Validate latitude range `-90..90` and longitude range `-180..180`.
- [ ] Store original URL, resolved URL, extracted lat/lon, extraction strategy, and extraction errors.
- [ ] Do not post or log secret game coordinates to the public channel.



## Nominatim Reverse Geocoding

- [ ] Implement a `GeocodingService` module.
- [ ] Request `format=jsonv2`, `addressdetails=1`, and `layer=address`.
- [ ] Consider `zoom=3` for country-level fallback and higher zoom for region extraction.
- [ ] Configure `User-Agent` and optional contact email.
- [ ] Handle rate limits, non-200 responses, empty results, and malformed JSON.
- [ ] Cache reverse geocoding results by rounded lat/lon or exact coordinate hash.
- [ ] Persist raw response JSON in Postgres for audit/debugging.
- [ ] Normalize country code to ISO 3166-1 alpha-2 uppercase internally.
- [ ] Store region/admin information when available, for example state, province, county, or `geocodejson` admin levels.
- [ ] Add a manual correction path in the data model even if no command is implemented yet.



## Guess Detection



### Country Dictionary

- [ ] Create a filesystem-backed `ValidGuesses` data source.
- [ ] Include ISO 3166-1 alpha-2 codes, for example `NL`.
- [ ] Include ISO 3166-1 alpha-3 codes, for example `NLD`.
- [ ] Include English country names.
- [ ] Include Turkish country names.
- [ ] Include common aliases and punctuation variants, for example `the netherlands`, `holland`, `turkiye`, `türkiye`.
- [ ] Normalize all aliases to one canonical country code.
- [ ] Store display names in English and Turkish.
- [ ] Add tests for ambiguous names and aliases.

Recommended file layout:

```text
src/domain/countries/valid-guesses.ts
src/domain/countries/countries.json
src/domain/countries/normalize-country-guess.ts
```



### Message Parsing

- [ ] Implement a `GuessParser` module.
- [ ] Ignore messages that start with configured command prefixes, except command handlers.
- [ ] Ignore long chatty messages unless they contain a clear standalone country guess.
- [ ] Support case-insensitive guesses.
- [ ] Support diacritic-insensitive matching where appropriate, while preserving Turkish-specific aliases.
- [ ] Trim punctuation and surrounding whitespace.
- [ ] Treat `NL`, `NLD`, `Netherlands`, `the Netherlands`, and Turkish names as the same canonical country.
- [ ] Avoid false positives from ordinary chat, for example "in", "can", "no", or short words that collide with country codes.
- [ ] Decide and document whether multi-country messages are ignored or the first valid country is accepted.
- [ ] Add parser unit tests with English, Turkish, ISO code, alias, typo-adjacent, and normal-chat examples.



### Repeat Guesses

- [ ] Track all canonical wrong country guesses for the active game in Redis.
- [ ] Persist all guesses to Postgres with canonical country code, raw text, parser confidence, and repeat flag.
- [ ] If a country was already guessed incorrectly, react with `🔄`.
- [ ] Repeat guesses should not count as new wrong guesses for map coloring or game-master difficulty metrics unless the rule table says otherwise.
- [ ] Repeat guesses may still count toward player total messages/guess attempts if configured.



## Discord Runtime



### Bot Setup

- [ ] Configure Discord token through environment variables.
- [ ] Configure guild ID, game channel ID, optional log channel ID, and role IDs.
- [ ] Request only necessary Discord gateway intents:
  - [ ] Guilds
  - [ ] Guild messages
  - [ ] Message content
  - [ ] Guild members if role lookup requires it
  - [ ] Direct messages
- [ ] Add partials needed for DMs and attachments.
- [ ] Add startup health logs.
- [ ] Add graceful shutdown for Discord, Redis, BullMQ, and database connections.



### Message Pipeline

- [ ] Route all message create events through a small dispatcher.
- [ ] Separate command detection, game start detection, and guess detection.
- [ ] Ensure active game state is loaded from Redis first and falls back to Postgres recovery.
- [ ] Keep message handlers idempotent where possible.
- [ ] Add structured logging with guild ID, channel ID, user ID, message ID, and game ID.



### Reactions and Responses

- [ ] React quickly before performing slower persistence when safe.
- [ ] Handle missing permission errors for adding reactions, deleting messages, sending files, and reading DMs.
- [ ] If a reaction fails, log the error and continue the game state transition where appropriate.
- [ ] Avoid leaking target country, region, or coordinates in errors.



## Commands

Commands should support multiple localized aliases. Initial command aliases:

- Map:
  - [ ] `!map`
  - [ ] `!harita`
- Region maps:
  - [ ] `!europe`
  - [ ] `!avrupa`
  - [ ] `!asia`
  - [ ] `!asya`
  - [ ] `!africa`
  - [ ] `!afrika`
  - [ ] `!northamerica`
  - [ ] `!kuzeyamerika`
  - [ ] `!southamerica`
  - [ ] `!guneyamerika`
  - [ ] `!oceania`
  - [ ] `!okyanusya`
- Screenshot repost:
  - [ ] `!ss`
  - [ ] `!screenshot`
  - [ ] `!ekran`
- Profile:
  - [ ] `!profile`
  - [ ] `!profil`
- Leaderboards:
  - [ ] `!leaderboard`
  - [ ] `!liderlik`
  - [ ] `!top`
- Stats:
  - [ ] `!stats`
  - [ ] `!istatistik`
- Help:
  - [ ] `!help`
  - [ ] `!yardim`

Command implementation tasks:

- [ ] Create command registry with aliases and localized response labels.
- [ ] Commands should be ignored in DMs unless explicitly supported.
- [ ] Commands should validate verified role where required.
- [ ] Commands should handle no-active-game state cleanly.
- [ ] `!ss` should repost the current screenshot URL from Discord, not reupload from local storage.
- [ ] Add tests for alias routing.



## Map Rendering



### Requirements

- [ ] Generate a world map image in milliseconds for current wrong guesses.
- [ ] Generate regional map images for configured regions.
- [ ] Use `d3-geo`, `topojson-client`, and `world-atlas`.
- [ ] Wrong guessed countries are red.
- [ ] Correct country is green on final map only.
- [ ] Unguessed countries are neutral.
- [ ] Ocean/background and borders should be readable in Discord dark and light themes.
- [ ] Output should be a PNG attachment or supported image buffer.



### Implementation Plan

- [ ] Build a `MapRenderer` module with pure input/output:
  - [ ] Input: list of wrong ISO alpha-2 country codes
  - [ ] Input: optional correct ISO alpha-2 country code
  - [ ] Input: viewport preset, for example world/europe/asia
  - [ ] Output: image buffer and filename
- [ ] Load `world-atlas` TopoJSON once at startup and cache parsed GeoJSON features.
- [ ] Resolve ISO alpha-2 guesses to the numeric/id format used by `world-atlas`.
- [ ] Define viewport presets with projection, scale, center, and clip/fit behavior.
- [ ] Use an SVG/canvas-compatible rendering strategy, then convert to PNG with Bun image APIs if needed.
- [ ] Benchmark cold and warm render times.
- [ ] Cache rendered maps by game ID, wrong-country set hash, correct-country code, and viewport.
- [ ] Invalidate map cache after each new non-repeat wrong guess and at game end.
- [ ] Add visual regression/snapshot tests if practical.



### Region Presets

- [ ] World
- [ ] Europe
- [ ] Asia
- [ ] Africa
- [ ] North America
- [ ] South America
- [ ] Oceania
- [ ] Optional future: Middle East, Balkans, Scandinavia, Caribbean



## Active Game State

Use Redis for active game state and Postgres as durable history.

### Redis Keys

Proposed key names:

```text
game:active:{guildId}:{channelId}
game:{gameId}:state
game:{gameId}:wrong-countries
game:{gameId}:guess-streaks
game:{gameId}:map-cache:{viewport}:{hash}
pending-start:{guildId}:{userId}
pending-dm-start:{userId}
```



### Redis State Tasks

- [ ] Store active game ID by guild/channel.
- [ ] Store game master user ID.
- [ ] Store target country code and region.
- [ ] Store screenshot Discord attachment URL.
- [ ] Store wrong country set.
- [ ] Store current multiplier.
- [ ] Store last guess timestamp.
- [ ] Store consecutive guess counters.
- [ ] Store pending start submissions.
- [ ] Apply TTLs to pending starts and cache keys.
- [ ] Rehydrate active game state from Postgres if Redis is lost and a game is still marked active.



## Database Design

All table names must be singular.

### Table Checklist

- [ ] `rule`
- [ ] `player`
- [ ] `guild`
- [ ] `channel`
- [ ] `game`
- [ ] `location`
- [ ] `guess`
- [ ] `player_game`
- [ ] `player_stat`
- [ ] `country_stat`
- [ ] `game_master_milestone`
- [ ] `point_ledger`
- [ ] `multiplier_event`
- [ ] `command_log`
- [ ] `start_attempt`
- [ ] `schema_event` or audit table, optional



### `rule`

Single-row game settings table.

- [ ] `id`
- [ ] `verified_role_id`
- [ ] `verified_role_name`
- [ ] `game_channel_id`
- [ ] `log_channel_id`
- [ ] `command_prefixes`
- [ ] `max_consecutive_guesses`
- [ ] `consecutive_guess_idle_reset_seconds`
- [ ] `pending_start_ttl_seconds`
- [ ] `base_win_points`
- [ ] `current_multiplier_max`
- [ ] `gm_multiplier_max`
- [ ] `idle_multiplier_interval_seconds`
- [ ] `idle_multiplier_increment`
- [ ] `long_game_multiplier_increment`
- [ ] `one_shot_bonus`
- [ ] `repeat_guess_counts_for_stats`
- [ ] `repeat_guess_counts_for_gm_difficulty`
- [ ] `queue_game_starts`
- [ ] `nominatim_email`
- [ ] `created_at`
- [ ] `updated_at`



### `player`

- [ ] `id`
- [ ] `discord_user_id` unique
- [ ] `display_name`
- [ ] `first_seen_at`
- [ ] `last_seen_at`
- [ ] `created_at`
- [ ] `updated_at`



### `guild`

- [ ] `id`
- [ ] `discord_guild_id` unique
- [ ] `name`
- [ ] `created_at`
- [ ] `updated_at`



### `channel`

- [ ] `id`
- [ ] `guild_id`
- [ ] `discord_channel_id` unique
- [ ] `name`
- [ ] `kind`
- [ ] `created_at`
- [ ] `updated_at`



### `game`

- [ ] `id`
- [ ] `guild_id`
- [ ] `channel_id`
- [ ] `game_master_player_id`
- [ ] `location_id`
- [ ] `status`: pending/active/completed/cancelled/failed
- [ ] `screenshot_url`
- [ ] `screenshot_message_id`
- [ ] `announcement_message_id`
- [ ] `started_at`
- [ ] `ended_at`
- [ ] `winner_player_id`
- [ ] `winning_guess_id`
- [ ] `wrong_guess_count`
- [ ] `unique_wrong_country_count`
- [ ] `total_guess_count`
- [ ] `repeat_guess_count`
- [ ] `base_points`
- [ ] `current_multiplier_final`
- [ ] `gm_multiplier_at_start`
- [ ] `points_awarded`
- [ ] `created_at`
- [ ] `updated_at`



### `location`

- [ ] `id`
- [ ] `original_google_maps_url`
- [ ] `resolved_google_maps_url`
- [ ] `latitude`
- [ ] `longitude`
- [ ] `coordinate_source`
- [ ] `country_code`
- [ ] `country_name`
- [ ] `region_name`
- [ ] `region_code`
- [ ] `nominatim_place_id`
- [ ] `nominatim_osm_type`
- [ ] `nominatim_osm_id`
- [ ] `nominatim_raw_json`
- [ ] `manual_country_code`
- [ ] `manual_region_name`
- [ ] `is_manually_corrected`
- [ ] `created_at`
- [ ] `updated_at`



### `guess`

- [ ] `id`
- [ ] `game_id`
- [ ] `player_id`
- [ ] `discord_message_id`
- [ ] `raw_message`
- [ ] `parsed_country_code`
- [ ] `parsed_country_name`
- [ ] `parser_strategy`
- [ ] `is_correct`
- [ ] `is_repeat`
- [ ] `is_rate_limited`
- [ ] `reaction`
- [ ] `created_at`



### `player_game`

Participation join table for future achievement work.

- [ ] `id`
- [ ] `player_id`
- [ ] `game_id`
- [ ] `role`: game_master/player/winner
- [ ] `guess_count`
- [ ] `unique_wrong_guess_count`
- [ ] `repeat_guess_count`
- [ ] `first_guess_at`
- [ ] `last_guess_at`
- [ ] `created_at`
- [ ] `updated_at`



### `player_stat`

Denormalized stats for fast profile/leaderboard reads.

- [ ] `id`
- [ ] `player_id` unique
- [ ] `games_started`
- [ ] `games_participated`
- [ ] `games_won`
- [ ] `total_guesses`
- [ ] `correct_guesses`
- [ ] `wrong_guesses`
- [ ] `repeat_guesses`
- [ ] `points_total`
- [ ] `best_single_game_points`
- [ ] `current_gm_multiplier`
- [ ] `max_game_wrong_guess_count_as_gm`
- [ ] `created_at`
- [ ] `updated_at`



### `country_stat`

- [ ] `id`
- [ ] `country_code` unique
- [ ] `times_used_as_target`
- [ ] `times_guessed`
- [ ] `times_guessed_wrong`
- [ ] `times_guessed_correct`
- [ ] `created_at`
- [ ] `updated_at`



### `game_master_milestone`

- [ ] `id`
- [ ] `player_id`
- [ ] `milestone_guess_count`
- [ ] `game_id`
- [ ] `earned_multiplier_increment`
- [ ] `earned_at`



### `point_ledger`

Append-only point changes.

- [ ] `id`
- [ ] `player_id`
- [ ] `game_id`
- [ ] `reason`
- [ ] `base_points`
- [ ] `current_multiplier`
- [ ] `gm_multiplier`
- [ ] `points_delta`
- [ ] `created_at`



### `multiplier_event`

- [ ] `id`
- [ ] `game_id`
- [ ] `kind`: idle/long_game/one_shot/manual/other
- [ ] `previous_multiplier`
- [ ] `increment`
- [ ] `new_multiplier`
- [ ] `message_id`
- [ ] `created_at`



### Future Achievement Compatibility

- [ ] Keep `player_game` as the base fact table for participation achievements.
- [ ] Keep `point_ledger` append-only so point history can be audited.
- [ ] Keep `game_master_milestone` separate from `player_stat` so achievements can reference concrete games.
- [ ] Add future tables without rewriting existing stats:
  - [ ] `achievement`
  - [ ] `player_achievement`
  - [ ] `achievement_progress`



## Drizzle ORM Plan

- [ ] Use `snakeCase.table(...)` for PostgreSQL table definitions.
- [ ] Use Drizzle v1 `defineRelations()` instead of removed RQB v1 patterns.
- [ ] Use explicit indexes for common leaderboard/profile queries.
- [ ] Use generated migration folders compatible with Drizzle Kit v1.
- [ ] Add a seed script for the single `rule` row.
- [ ] Add seed data for country aliases if stored in DB later.
- [ ] Avoid plural table names.
- [ ] Add database transaction helpers for game completion and point award flow.

Recommended layout:

```text
src/db/client.ts
src/db/schema.ts
src/db/relations.ts
src/db/migrations/
src/db/seed.ts
```



## Points and Multipliers



### Player Reward Formula

- [ ] Base formula: `BASE x CURRENT x GM`
- [ ] Default base points: `100`
- [ ] Maximum current multiplier: `2x`
- [ ] Default GM multiplier: `1x`
- [ ] Maximum GM multiplier: `3x`
- [ ] Example: `100 x 1.8 x 1.2 = 216`
- [ ] Store all three parts in the game and point ledger.
- [ ] Decide rounding policy and store it in `rule`, default integer rounding.



### Current Multiplier

- [ ] Current multiplier starts at `1x`.
- [ ] Bot adds increments to current multiplier; separate bonus types are not multiplied together.
- [ ] Current multiplier is capped by `rule.current_multiplier_max`.
- [ ] Idle multiplier increases when no guesses occur for configured interval, for example every `15 minutes`.
- [ ] Bot announces multiplier increases in the game channel.
- [ ] Long-game bonus can be added after configured duration or guess count.
- [ ] One-shot bonus can be added if desired, but must be clearly defined before implementation.
- [ ] Every multiplier change is written to `multiplier_event`.



### Game Master Multiplier

- [ ] GM multiplier starts at `1x`.
- [ ] GM earns `0.1x` per milestone.
- [ ] Milestones are unique thresholds based on the best number of guesses in a game they started:
  - [ ] 10
  - [ ] 20
  - [ ] 30
  - [ ] 40
  - [ ] Continue every 10 through 200
- [ ] Multiple games in the same milestone range do not award duplicate increments.
- [ ] A game with 23, 25, and 28 guesses leaves the GM at milestones 10 and 20 only.
- [ ] A later game with 30 or more guesses awards the 30 milestone.
- [ ] GM multiplier is capped at `3x`.
- [ ] Store milestone awards in `game_master_milestone`.
- [ ] Snapshot `gm_multiplier_at_start` onto each game so reward math remains historically stable.



## BullMQ Jobs

- [ ] Configure Redis connection shared with BullMQ.
- [ ] Create queues:
  - [ ] `game-multiplier`
  - [ ] `pending-start-cleanup`
  - [ ] `active-game-recovery`
  - [ ] Optional `stats-rollup`
- [ ] Schedule idle multiplier checks per active game.
- [ ] Cancel or no-op multiplier jobs after game completion.
- [ ] Use idempotent job IDs, for example `idle-multiplier:{gameId}`.
- [ ] On each check, compare `last_guess_at` to current time before increasing multiplier.
- [ ] Persist multiplier changes before announcing them.
- [ ] Add tests around idle timing and max multiplier cap.



## Stats Tracking



### Global Stats

- [ ] Number of games started.
- [ ] Number of games completed.
- [ ] Number of games cancelled/failed.
- [ ] Target country frequency.
- [ ] Total guesses.
- [ ] Total unique wrong country guesses.
- [ ] Total repeat guesses.
- [ ] Average guesses per completed game.
- [ ] Hardest games by wrong guess count.
- [ ] Most successful game masters.



### Player Stats

- [ ] Games participated.
- [ ] Games won.
- [ ] Win rate: `won / participated`.
- [ ] Games started.
- [ ] Total guesses.
- [ ] Correct guesses.
- [ ] Wrong guesses.
- [ ] Repeat guesses.
- [ ] Points total.
- [ ] Best single-game point award.
- [ ] GM multiplier.
- [ ] Best game as GM by guess count.



### Stats Implementation

- [ ] Write normalized fact rows first: `game`, `guess`, `player_game`, `point_ledger`.
- [ ] Update denormalized `player_stat` and `country_stat` in the same transaction where practical.
- [ ] Add a rebuild script to recompute denormalized stats from fact tables.
- [ ] Add tests for stats updates after wrong guess, repeat guess, correct guess, and game completion.



## Leaderboards

- [ ] Games won leaderboard.
- [ ] Games started leaderboard.
- [ ] Points leaderboard.
- [ ] Game-master hardest-games leaderboard, ordered by most guesses on games started.
- [ ] Optional leaderboard filters:
  - [ ] All time
  - [ ] Monthly
  - [ ] Weekly
  - [ ] Current guild only
- [ ] Use stable tie-breakers, for example points then wins then earliest first.
- [ ] Use paginated Discord responses if output is long.
- [ ] Add tests for leaderboard query ordering.



## Profiles

- [ ] `!profile`/`!profil` shows the requesting player's summary.
- [ ] Optional mention syntax later: `!profile @user`.
- [ ] Include participated games, wins, win rate, games started, total guesses, points, GM multiplier, and best GM game.
- [ ] Keep profile read path fast through `player_stat`.
- [ ] Fall back to zero/default stats for new players.



## Error Handling and Moderation

- [ ] Add structured logger.
- [ ] Add log channel notifications for failed game starts and unexpected runtime errors.
- [ ] Avoid sending stack traces to public channels.
- [ ] Treat missing permissions as configuration errors with clear log messages.
- [ ] Add admin-only command later for cancelling stuck games.
- [ ] Add admin-only command later for manually correcting country/region.
- [ ] Add admin-only command later for rebuilding stats.



## Configuration



### Environment Variables

- [ ] `DISCORD_TOKEN`
- [ ] `DISCORD_CLIENT_ID`
- [ ] `DISCORD_GUILD_ID`
- [ ] `DISCORD_GAME_CHANNEL_ID`
- [ ] `DISCORD_LOG_CHANNEL_ID`
- [ ] `DATABASE_URL`
- [ ] `REDIS_URL`
- [ ] `NOMINATIM_USER_AGENT`
- [ ] `NOMINATIM_EMAIL`
- [ ] `NODE_ENV`



### Runtime Rules

- [ ] Rules live in the `rule` table.
- [ ] Environment variables can provide bootstrap defaults.
- [ ] On startup, create the singleton rule row if it does not exist.
- [ ] Cache rules in memory with a short TTL.
- [ ] Add a future admin command to reload rules.



## Suggested Module Layout

```text
src/
  bot/
    client.ts
    events/
      message-create.ts
      ready.ts
    permissions.ts
    reactions.ts
  commands/
    command-registry.ts
    map-command.ts
    screenshot-command.ts
    profile-command.ts
    leaderboard-command.ts
  config/
    env.ts
    rules.ts
  db/
    client.ts
    schema.ts
    relations.ts
    repositories/
  domain/
    countries/
      countries.json
      normalize-country-guess.ts
      valid-guesses.ts
    game/
      active-game-state.ts
      game-service.ts
      scoring.ts
      rate-limit.ts
    geocoding/
      google-maps-parser.ts
      nominatim-client.ts
      geocoding-service.ts
    maps/
      map-renderer.ts
      region-presets.ts
  jobs/
    queues.ts
    multiplier-worker.ts
    cleanup-worker.ts
  redis/
    client.ts
    keys.ts
  stats/
    stats-service.ts
    leaderboard-service.ts
  test/
    fixtures/
```



## Testing Plan



### Unit Tests

- [ ] Country guess normalization.
- [ ] Turkish country aliases.
- [ ] English country aliases.
- [ ] ISO alpha-2 and alpha-3 handling.
- [ ] False positive avoidance in normal chat.
- [ ] Google Maps coordinate extraction.
- [ ] Nominatim response normalization.
- [ ] Consecutive guess rate limit logic.
- [ ] Scoring and multiplier caps.
- [ ] GM milestone calculation.
- [ ] Command alias routing.
- [ ] Map country-code mapping.



### Integration Tests

- [ ] Database migrations apply cleanly.
- [ ] Game start transaction creates location/game/player rows.
- [ ] Wrong guess persists and updates Redis/Postgres state.
- [ ] Repeat guess detection works across aliases.
- [ ] Correct guess completes the game and awards points.
- [ ] Stats update transaction is correct.
- [ ] BullMQ idle multiplier job updates and announces exactly once.
- [ ] Redis recovery path can restore active game from Postgres.



### Manual Discord Test Checklist

- [ ] Start via DM with link and screenshot in one message.
- [ ] Start via DM with screenshot first.
- [ ] Start via DM with link first.
- [ ] Start via channel link then channel screenshot.
- [ ] Start via channel link then DM screenshot.
- [ ] Link message is deleted quickly from channel.
- [ ] Screenshot source message is deleted quickly from channel start flow.
- [ ] Unverified user cannot start.
- [ ] Unverified user cannot guess.
- [ ] Game master cannot guess.
- [ ] Wrong guess receives `❌`.
- [ ] Correct guess receives `✅`.
- [ ] Repeat guess receives `🔄`.
- [ ] `!map` and `!harita` work.
- [ ] Regional map command works.
- [ ] `!ss` reposts screenshot.
- [ ] Winner announcement includes point formula.



## Implementation Phases



### Phase 1: Foundation

- [ ] Create source directory layout.
- [ ] Add environment config validation.
- [ ] Add Postgres and Redis clients.
- [ ] Add Drizzle schema and initial migration.
- [ ] Add singleton rule seed.
- [ ] Add Discord client startup and ready logging.
- [ ] Add graceful shutdown.



### Phase 2: Country and Location

- [ ] Add country dictionary and aliases.
- [ ] Add guess normalization tests.
- [ ] Add Google Maps parser.
- [ ] Add Nominatim client.
- [ ] Add location persistence.



### Phase 3: Game Lifecycle

- [ ] Implement active game Redis state.
- [ ] Implement game start from DM.
- [ ] Implement game start from channel.
- [ ] Implement hybrid start.
- [ ] Implement screenshot posting.
- [ ] Implement game completion.



### Phase 4: Guessing

- [ ] Implement message guess parser.
- [ ] Implement verified role checks.
- [ ] Implement game-master guess block.
- [ ] Implement consecutive guess limiter.
- [ ] Implement wrong/correct/repeat reactions.
- [ ] Persist guesses and participation.



### Phase 5: Maps

- [ ] Implement TopoJSON loading.
- [ ] Implement ISO code mapping.
- [ ] Implement world map render.
- [ ] Implement regional presets.
- [ ] Implement map cache.
- [ ] Wire `!map` and localized aliases.
- [ ] Wire final map into winner announcement.



### Phase 6: Scoring and Jobs

- [ ] Implement point formula.
- [ ] Implement current multiplier events.
- [ ] Implement BullMQ idle multiplier worker.
- [ ] Implement GM milestone calculation.
- [ ] Implement point ledger transaction.
- [ ] Announce reward formula on game end.



### Phase 7: Stats and Leaderboards

- [ ] Implement player stats updates.
- [ ] Implement country stats updates.
- [ ] Implement stats rebuild script.
- [ ] Implement profile command.
- [ ] Implement games won leaderboard.
- [ ] Implement games started leaderboard.
- [ ] Implement points leaderboard.
- [ ] Implement game-master hardest-games leaderboard.



### Phase 8: Hardening

- [ ] Add integration tests.
- [ ] Add manual Discord test script/checklist.
- [ ] Add logging and error handling polish.
- [ ] Add deployment docs.
- [ ] Add operational notes for Nominatim usage policy.
- [ ] Add backup/recovery notes for Postgres and Redis.



## Open Decisions

- [ ] Should repeat guesses count toward a player's total guess count?
- [ ] Should repeat guesses count toward game-master difficulty metrics?
- [ ] Should rate-limited guesses receive a reaction, and if yes, which emoji?
- [ ] Should pending game starts be queued when a game is active, or rejected?
- [ ] Should multi-country messages be ignored or should the first valid country be accepted?
- [ ] What rounding policy should final point awards use?
- [ ] Should map rendering use SVG-to-PNG conversion, direct canvas rendering, or a lightweight HTML/canvas render path?
- [ ] Should public Nominatim be used in production, or should deployment include a configured geocoding provider/self-hosted Nominatim option?



## Non-Goals for Initial Implementation

- [ ] No image storage outside Discord attachment URLs.
- [ ] No achievement command yet, but database design must support future achievements.
- [ ] No slash commands required initially.
- [ ] No web dashboard initially.
- [ ] No manual country correction command initially, but schema must support corrections.
- [ ] No multi-game-per-channel support initially unless explicitly added later.



## References

- Nominatim reverse geocoding: [https://nominatim.org/release-docs/latest/api/Reverse/](https://nominatim.org/release-docs/latest/api/Reverse/)
- Drizzle ORM v1 changes: [https://raw.githubusercontent.com/drizzle-team/drizzle-orm-docs/5886f5a1cc39b68b433f773a89fbab459b99a3c3/src/content/docs/pg/v0-v1-changes.mdx](https://raw.githubusercontent.com/drizzle-team/drizzle-orm-docs/5886f5a1cc39b68b433f773a89fbab459b99a3c3/src/content/docs/pg/v0-v1-changes.mdx)
- Bun Image API: [https://bun.com/docs/runtime/image](https://bun.com/docs/runtime/image)

