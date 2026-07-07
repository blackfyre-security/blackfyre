import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import type { Config } from "../config.js";

export function createDb(config: Config) {
  const connectionString = config.DATABASE_URL;
  const client = postgres(connectionString, { max: 10 });
  const superClient = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });
  const superDb = drizzle(superClient, { schema });
  return { db, superDb, sql: client, superSql: superClient };
}

export type Db = ReturnType<typeof createDb>["db"];

/**
 * Wrap a reserved postgres.js connection (from `sql.reserve()`) in a drizzle
 * handle for the per-request RLS-bound `request.db`.
 *
 * BUG FIX (found during community local-dev verification, 2026-07): postgres.js's
 * `reserve()` returns a Sql instance WITHOUT the `.options` property at runtime
 * (the typings say ReservedSql extends Sql, but the internal Sql(handler) factory
 * only attaches types/typed/unsafe/notify/array/json/file). drizzle-orm 0.33's
 * postgres-js driver unconditionally patches `client.options.parsers` /
 * `client.options.serializers` at construction, so `drizzle(reservedConn)` threw
 * `TypeError: Cannot read properties of undefined (reading 'parsers')` on EVERY
 * authenticated request. authenticate() correctly fails closed, so the visible
 * symptom was a blanket 401 "Invalid or expired token" for perfectly valid tokens.
 *
 * The reserved connection executes queries with the PARENT pool's options object
 * (parsers/serializers are read from the pool options captured at connect time),
 * and createDb()'s own `drizzle(client)` call above has already applied drizzle's
 * parser patches to that object — so exposing the parent's options on the reserved
 * handle is semantically exact, and drizzle's re-patch is an idempotent no-op.
 *
 * KNOWN LIMITATION (pre-existing, unchanged here): the runtime ReservedSql also
 * lacks `.begin`, so `request.db.transaction(...)` is not supported — routes that
 * need a transaction must use `app.db`/`app.superDb` with explicit tenant scoping.
 */
export function drizzleReserved(conn: postgres.ReservedSql, parent: postgres.Sql) {
  const reserved = conn as unknown as { options?: unknown };
  if (!reserved.options) {
    reserved.options = (parent as unknown as { options: unknown }).options;
  }
  return drizzle(conn as unknown as postgres.Sql, { schema });
}
