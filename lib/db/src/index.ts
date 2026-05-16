import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Replit-hosted Postgres uses a cert chain that node-postgres doesn't
  // trust by default. In production we still want TLS (sslmode=require in
  // the URL), we just can't verify the self-signed leaf. Disable in dev
  // via PGSSLMODE=disable.
  ssl:
    process.env.PGSSLMODE === "disable"
      ? false
      : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
