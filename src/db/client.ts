import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.ts";

export const sqlClient = postgres(env.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // CREATE SCHEMA IF NOT EXISTS drizzle emits 42P06 NOTICE on every boot.
  onnotice: () => undefined,
});

export const db = drizzle({ client: sqlClient });

export const closeDatabase = async () => {
  await sqlClient.end({ timeout: 5 });
};
