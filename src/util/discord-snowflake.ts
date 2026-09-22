const DISCORD_EPOCH_MS = 1_420_070_400_000n;

/** Discord user and message ids encode their creation time. */
export const discordSnowflakeToDate = (id: string): Date | undefined => {
  if (!/^\d{1,20}$/.test(id)) {
    return undefined;
  }

  try {
    const snowflake = BigInt(id);
    if (snowflake > 9223372036854775807n) {
      return undefined;
    }
    const ms = (snowflake >> 22n) + DISCORD_EPOCH_MS;
    const asNumber = Number(ms);
    if (!Number.isSafeInteger(asNumber)) {
      return undefined;
    }
    return new Date(asNumber);
  } catch {
    return undefined;
  }
};
