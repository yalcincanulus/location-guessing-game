# Discord Test Channel Setup

This guide explains how to add the private test bot to your Discord server/channel.

## Client Secret

The Discord **Client Secret** is not needed for this bot right now.

This project logs in with the **Bot Token** through `DISCORD_TOKEN`. The Client Secret is only needed for OAuth2 authorization-code flows where a backend exchanges user authorization codes for user access tokens.

## Developer Portal Settings

Open https://discord.com/developers/applications and select your application.

### General Information

- [ ] Copy **Application ID** into `DISCORD_CLIENT_ID`.
- [ ] Do not use or commit the Client Secret.

### Installation

For a private test bot:

- [ ] Enable **Guild Install**.
- [ ] Disable **User Install** unless you need it later.
- [ ] Set **Install Link** / **Default Authorization Link** to **None**.

If Discord shows this error while disabling **Public Bot**:

```text
Private application cannot have a default authorization link.
Please check that the default authorization link is set to None in the installation tab.
Note: Verified apps must be public.
```

Fix it in this order:

1. Go to **Installation**.
2. Set **Install Link** / **Default Authorization Link** to **None**.
3. Save.
4. Go to **Bot**.
5. Disable **Public Bot**.
6. Save.

Verified Discord apps must be public. For a private test bot, use an unverified development application.

### Bot

- [ ] Copy/reset the **Bot Token** into `DISCORD_TOKEN`.
- [ ] Set `BOT_LOCALE=en` or `BOT_LOCALE=tr` to choose the bot message language.
- [ ] Disable **Public Bot**.
- [ ] Disable **Requires OAuth2 Code Grant**.
- [ ] Enable **Message Content Intent**.
- [ ] Enable **Server Members Intent**.
- [ ] Leave **Presence Intent** disabled.

## Invite Link

Use **OAuth2 -> OAuth2 URL Generator**.

Scopes:

- [ ] `bot`

Bot permissions:

- [ ] View Channel
- [ ] Send Messages
- [ ] Attach Files
- [ ] Read Message History
- [ ] Add Reactions
- [ ] Manage Messages

Manual invite URL shape:

```text
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot&permissions=109632
```

Keep the application's default authorization/install link set to **None** after setup if the bot should stay private.

## Channel Setup

1. Create a test text channel.
2. Copy the channel ID into `DISCORD_GAME_CHANNEL_ID`.
3. Give the bot permissions only in that channel.
4. Create a role named `verified`.
5. Assign `verified` to users who can start games and guess.

If the `rule` row already exists, update it after changing channel or role IDs:

```sql
UPDATE rule
SET game_channel_id = 'YOUR_CHANNEL_ID',
    verified_role_id = 'YOUR_VERIFIED_ROLE_ID',
    updated_at = now();
```

## Test Mode

Enable test mode when you are alone in the test channel and need to guess your own games or use debug utilities:

```sql
UPDATE rule
SET test_mode_enabled = true,
    test_channel_id = 'YOUR_TEST_CHANNEL_ID',
    test_admin_user_ids = '["YOUR_DISCORD_USER_ID"]'::jsonb,
    updated_at = now();
```

Disable it:

```sql
UPDATE rule
SET test_mode_enabled = false,
    updated_at = now();
```

Test utilities:

```text
!test status
!test cancel testing
!test reveal
!test tick
!test reset
```

Test games are stored for debugging but do not award points and do not affect stats, leaderboards, or game-master milestones.

## Run

```bash
bun run db:migrate
bun run start
```

## Smoke Test

1. Send a Google Maps link in the test channel.
2. Confirm the bot deletes it.
3. Send a screenshot image.
4. Confirm the bot posts the game.
5. Guess a wrong country and confirm `❌`.
6. Guess the same country through another alias and confirm `🔄`.
7. Guess the correct country and confirm `✅`, winner announcement, and final map.

Useful commands:

```text
!map
!harita
!europe
!ss
!profile
!leaderboard
!stats
```
