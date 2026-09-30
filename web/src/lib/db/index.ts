import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not defined.");
}

// Serverless HTTP client for Neon (lightning fast, zero pooling latency)
const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
export * from "./schema";

