import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_lTEkwg2CF5oR@ep-round-resonance-b28ccax8.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require";

// Serverless HTTP client for Neon (lightning fast, zero pooling latency)
const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
export * from "./schema";
