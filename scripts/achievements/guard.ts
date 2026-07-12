/** Refuse non-local DATABASE_URL so sims never hit production. */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

export const assertLocalDatabaseUrl = (databaseUrl: string) => {
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error(`Invalid DATABASE_URL: ${databaseUrl}`);
  }

  if (!LOCAL_HOSTS.has(host.toLowerCase())) {
    throw new Error(
      `Achievement sims refuse non-local DATABASE_URL host "${host}". ` +
        `Allowed: ${[...LOCAL_HOSTS].join(", ")}`,
    );
  }
};
