-- Replace the raw-`updated_at` index with an expression index that matches
-- the discover query's ORDER BY exactly: `date_trunc('milliseconds',
-- updated_at) DESC, user_id DESC, id DESC` filtered by `is_public = true`.
-- A partial index on `is_public = true` keeps it small (only public trips).
-- Additive + idempotent: safe to run on a DB that already has the old index.
-- Note: `date_trunc(text, timestamptz)` is only STABLE (depends on the
-- session TimeZone), so Postgres rejects it in an index expression. Casting
-- to `timestamp without time zone` via `AT TIME ZONE 'UTC'` first yields
-- the IMMUTABLE `date_trunc(text, timestamp)` overload. The discover query
-- uses the same expression so the index matches exactly.
CREATE INDEX IF NOT EXISTS "trips_public_feed_expr_idx"
  ON "trips" USING btree (
    (date_trunc('milliseconds', "updated_at" AT TIME ZONE 'UTC')) DESC,
    "user_id" DESC,
    "id" DESC
  )
  WHERE "is_public" = true;
--> statement-breakpoint
DROP INDEX IF EXISTS "trips_public_feed_idx";
