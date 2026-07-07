import { defineRelations } from "drizzle-orm";
import { schema } from "./schema.ts";

export const relations = defineRelations(schema);
