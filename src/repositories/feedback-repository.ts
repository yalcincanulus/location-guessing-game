import { sqlClient } from "../db/client.ts";

export type DbFeedback = {
  id: string;
  playerId: string;
  discordUserId: string;
  displayName: string;
  discordMessageId: string;
  message: string;
  createdAt: Date;
};

type FeedbackRow = {
  id: string;
  player_id: string;
  discord_user_id: string;
  display_name: string;
  discord_message_id: string;
  message: string;
  created_at: Date | string;
};

const mapFeedbackRow = (row: FeedbackRow): DbFeedback => ({
  id: row.id,
  playerId: row.player_id,
  discordUserId: row.discord_user_id,
  displayName: row.display_name,
  discordMessageId: row.discord_message_id,
  message: row.message,
  createdAt: new Date(row.created_at),
});

const feedbackSelect = sqlClient`
  SELECT
    f.id,
    f.player_id,
    f.discord_message_id,
    f.message,
    f.created_at,
    p.discord_user_id,
    p.display_name
  FROM feedback f
  JOIN player p ON p.id = f.player_id
`;

export const createFeedback = async ({
  playerId,
  discordMessageId,
  message,
}: {
  playerId: string;
  discordMessageId: string;
  message: string;
}) => {
  const rows = await sqlClient`
    INSERT INTO feedback (player_id, discord_message_id, message)
    VALUES (${playerId}, ${discordMessageId}, ${message})
    ON CONFLICT (discord_message_id) DO NOTHING
    RETURNING id
  `;

  return rows[0]?.id as string | undefined;
};

export const listFeedback = async (limit = 20): Promise<DbFeedback[]> => {
  const rows = await sqlClient`
    ${feedbackSelect}
    ORDER BY f.created_at DESC, f.id DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => mapFeedbackRow(row as unknown as FeedbackRow));
};

export const getFeedbackById = async (id: string): Promise<DbFeedback | undefined> => {
  const rows = await sqlClient`
    ${feedbackSelect}
    WHERE f.id = ${id}
    LIMIT 1
  `;

  const row = rows[0];
  return row ? mapFeedbackRow(row as unknown as FeedbackRow) : undefined;
};
