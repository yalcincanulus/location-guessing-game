import { migrate as drizzleMigrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./client.ts";

export const migrate = async () => {
  await drizzleMigrate(db, { migrationsFolder: "./drizzle" });
};
