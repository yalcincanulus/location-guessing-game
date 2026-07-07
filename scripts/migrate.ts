import { migrate } from "../src/db/migrate.ts";
import { closeDatabase } from "../src/db/client.ts";
import { closeRedis } from "../src/redis/client.ts";
import { seedDefaultRules } from "../src/db/seed.ts";
import { logger } from "../src/util/logger.ts";

try {
  await migrate();
  await seedDefaultRules();
  logger.info("Database migration complete");
} finally {
  await closeRedis().catch(() => undefined);
  await closeDatabase().catch(() => undefined);
}
