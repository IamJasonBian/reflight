import {
  boolean,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const tripsTable = pgTable(
  "trips",
  {
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    payload: jsonb("payload").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    // Indexes are managed by hand-written migrations in lib/db/drizzle/
    // (run via `pnpm --filter @workspace/db run migrate`). The current
    // public-feed index is the simple `(is_public, updated_at)` btree
    // declared in 0000 and re-asserted in 0002. We previously had a
    // partial expression index over `date_trunc('ms', updated_at AT TIME
    // ZONE 'UTC') DESC, user_id, id` but it was reverted in 0002: that
    // shape trips a drizzle-kit serializer bug which Replit's publish-
    // time schema differ also hits, producing invalid DDL like
    // `(date_trunc(... text_ops, user_id timestamp_ops, id text_ops)`
    // with a missing closing paren — every publish would fail.
  }),
);

export type TripRow = typeof tripsTable.$inferSelect;
export type InsertTripRow = typeof tripsTable.$inferInsert;
