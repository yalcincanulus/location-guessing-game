import type { Client, User } from "discord.js";
import { loadRules } from "../../config/rules.ts";
import { messages } from "../../i18n/messages.ts";
import { logger } from "../../util/logger.ts";
import { isChannelNotable, ONESHOT_TIER } from "./catalog.ts";
import type { ProposedUnlock } from "./evaluate.ts";
import { insertUnlocks, type StoredUnlock } from "../../repositories/achievements-repository.ts";
import { getPlayerDiscordUserId } from "./metrics.ts";

const dmUser = async (client: Client, discordUserId: string, content: string) => {
  try {
    const user: User = await client.users.fetch(discordUserId);
    await user.send(content);
  } catch {
    // DMs may be closed; ignore.
  }
};

export const persistAndAnnounceUnlocks = async (
  client: Client,
  proposed: ProposedUnlock[],
  options: { announceChannel: boolean } = { announceChannel: true },
) => {
  if (proposed.length === 0) {
    return [] as StoredUnlock[];
  }

  const inserted = await insertUnlocks(
    proposed.map((unlock) => ({
      playerId: unlock.playerId,
      achievementId: unlock.achievementId,
      tier: unlock.tier,
      sourceGameId: unlock.sourceGameId,
      meta: unlock.meta,
    })),
  );

  if (inserted.length === 0) {
    return inserted;
  }

  const byPlayer = new Map<
    string,
    { unlocks: ProposedUnlock[]; displayName: string; discordUserId: string }
  >();

  for (const row of inserted) {
    const proposedMatch = proposed.find(
      (item) =>
        item.playerId === row.playerId &&
        item.achievementId === row.achievementId &&
        item.tier === row.tier,
    );
    if (!proposedMatch) {
      continue;
    }
    const identity = await getPlayerDiscordUserId(row.playerId);
    if (!identity) {
      continue;
    }
    const bucket = byPlayer.get(row.playerId) ?? {
      unlocks: [],
      displayName: identity.displayName,
      discordUserId: identity.discordUserId,
    };
    bucket.unlocks.push(proposedMatch);
    byPlayer.set(row.playerId, bucket);
  }

  const channelLines: string[] = [];

  for (const [, bucket] of byPlayer) {
    const dmLines = bucket.unlocks.map((unlock) =>
      messages.achievements.unlockedDm(
        unlock.achievementId,
        unlock.tier === ONESHOT_TIER ? null : unlock.tier,
      ),
    );
    if (dmLines.length > 0) {
      await dmUser(client, bucket.discordUserId, dmLines.join("\n"));
    }

    if (options.announceChannel) {
      for (const unlock of bucket.unlocks) {
        if (isChannelNotable(unlock.definition, unlock.tier === ONESHOT_TIER ? 0 : unlock.tier)) {
          channelLines.push(
            messages.achievements.unlockedChannel(
              unlock.achievementId,
              unlock.tier === ONESHOT_TIER ? null : unlock.tier,
              bucket.displayName,
            ),
          );
        }
      }
    }
  }

  if (options.announceChannel && channelLines.length > 0) {
    const rules = await loadRules();
    if (rules.gameChannelId) {
      const channel = await client.channels.fetch(rules.gameChannelId).catch(() => null);
      if (channel?.isSendable()) {
        // Discord 2000 char limit — chunk if needed
        let chunk = "";
        for (const line of channelLines) {
          if (chunk.length + line.length + 1 > 1900) {
            await channel.send(chunk);
            chunk = line;
          } else {
            chunk = chunk ? `${chunk}\n${line}` : line;
          }
        }
        if (chunk) {
          await channel.send(chunk);
        }
      } else {
        logger.warn("Achievements: game channel unavailable for notable unlocks");
      }
    }
  }

  return inserted;
};
