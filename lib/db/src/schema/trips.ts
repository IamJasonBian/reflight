import {
  boolean,
  index,
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
    // Mirrored from `payload.isPublic` so we can build an indexed Discover
    // feed without having to scan jsonb on every request. Server is the only
    // writer of this column and keeps it in sync on every PUT /trips.
    isPublic: boolean("is_public").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    publicFeedIdx: index("trips_public_feed_idx").on(t.isPublic, t.updatedAt),
  }),
);

export type TripRow = typeof tripsTable.$inferSelect;
export type InsertTripRow = typeof tripsTable.$inferInsert;
