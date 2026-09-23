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

// Drizzle replaces postgres.js date serializers with `(value) => value` so its
// own queries can pass preformatted strings. A Date then reaches Buffer.byteLength
// and game starts throw. Keep strings untouched and encode Date values here.
const dateTypeOids = [1082, 1083, 1114, 1182, 1184];
for (const oid of dateTypeOids) {
  sqlClient.options.serializers[oid] = (value: unknown) =>
    value instanceof Date ? value.toISOString() : value;
}

export const closeDatabase = async () => {
  await sqlClient.end({ timeout: 5 });
};
