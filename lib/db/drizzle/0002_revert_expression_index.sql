-- Revert the partial expression index introduced in 0001. The combination
-- of (expression column + regular columns) in a single index trips a bug
-- in drizzle-kit's serializer, which Replit's publish-time schema differ
-- also uses. Result: every publish emits invalid DDL like
-- `(date_trunc('ms', updated_at AT TIME ZONE 'UTC' text_ops, user_id
-- timestamp_ops, id text_ops) WHERE ...` — syntax error, deploy fails.
--
-- The fallback is the simple `(is_public, updated_at)` index from 0000:
-- the discover query's WHERE is_public = true uses it as a filter, and
-- ORDER BY date_trunc('ms', updated_at) DESC … falls back to an in-memory
-- sort. Acceptable while the public feed is small; we can revisit a
-- handwritten expression index AFTER teaching Replit's differ to leave
-- it alone (or migrate the discover query to a simpler ORDER BY).
--
-- Idempotent: both statements use IF EXISTS / IF NOT EXISTS guards.
DROP INDEX IF EXISTS "trips_public_feed_expr_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_public_feed_idx"
  ON "trips" USING btree ("is_public", "updated_at");
