import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

// Lazy singleton — the client is created on first use, not at import time, so
// `next build` and importing modules don't require DATABASE_URL to be set.
//
// Supabase note: use the TRANSACTION pooler connection string (port 6543) on serverless.
// The pgbouncer transaction pooler doesn't support prepared statements → `prepare: false`.

let _db: PostgresJsDatabase<typeof schema> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.local.example → .env.local and add your Supabase connection string."
    );
  }
  _sql = postgres(url, { prepare: false, max: 1 });
  _db = drizzle(_sql, { schema });
  return _db;
}

export { schema };
