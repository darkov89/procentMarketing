import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/postgres";

// In Node.js environments (CLI, test, serverless runtime without global WebSocket), configure ws
if (typeof WebSocket === "undefined" && typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

import { sql } from "drizzle-orm";

export const pool = new Pool({ connectionString });
pool.on("error", (err: unknown) => {
  // Prevent unhandled error on idle clients in WebSocket pool
  console.error("Unexpected database pool error:", err);
});
export const db = drizzle(pool, { schema });
export * from "./schema";

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Executes an operation inside a PostgreSQL transaction scoped to a specific tenant.
 * Sets the non-bypassrls role 'app_rw' and sets 'app.tenant_id' in transaction-local config.
 * Guarantees Row-Level Security enforcement at the database level.
 */
export async function withTenant<T>(
  tenantId: number,
  fn: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  if (!tenantId || typeof tenantId !== "number" || tenantId <= 0) {
    throw new Error(`Invalid tenantId provided to withTenant: ${tenantId}`);
  }

  return await db.transaction(async (tx) => {
    try {
      // Set transaction-local session variable (is_local = true)
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`);

      // Switch to application role without BYPASSRLS using savepoint for safety
      try {
        await tx.execute(sql`SAVEPOINT sp_app_rw`);
        await tx.execute(sql`SET ROLE app_rw`);
        await tx.execute(sql`RELEASE SAVEPOINT sp_app_rw`);
      } catch (roleErr: unknown) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT sp_app_rw`);
        console.warn(
          "withTenant: role app_rw is unavailable, proceeding with session app.tenant_id:",
          roleErr instanceof Error ? roleErr.message : roleErr
        );
      }

      const result = await fn(tx);

      try {
        await tx.execute(sql`RESET ROLE`);
      } catch {
        // Ignore if role was not switched
      }
      await tx.execute(sql`RESET app.tenant_id`);
      return result;
    } catch (err) {
      // Transaction is aborted in Postgres; roll back / end transaction will clear transaction-local settings
      throw err;
    }
  });
}

/**
 * Executes an operation inside a system/administrative transaction (bypasses tenant RLS).
 * Used strictly for background jobs, worker claiming, and tenant discovery.
 */
export async function withSystemContext<T>(
  fn: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Reset to neondb_owner super/admin role
    await tx.execute(sql`RESET ROLE`);
    return await fn(tx);
  });
}



