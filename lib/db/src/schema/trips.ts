import { sql } from "drizzle-orm";
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
    isPublic: boolean("is_public").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    // Partial expression index that matches the discover feed query exactly:
    // ORDER BY date_trunc('ms', updated_at) DESC, user_id DESC, id DESC,
    // filtered by is_public = true. Tie-break keys (user_id, id) make the
    // sort total — (user_id, id) is the trips primary key, so the
    // composite is globally unique even at the worst-case nanoid collision.
    publicFeedExprIdx: index("trips_public_feed_expr_idx")
      .on(
        sql`(date_trunc('milliseconds', "updated_at" AT TIME ZONE 'UTC')) DESC`,
        sql`"user_id" DESC`,
        sql`"id" DESC`,
      )
      .where(sql`"is_public" = true`),
  }),
);

export type TripRow = typeof tripsTable.$inferSelect;
export type InsertTripRow = typeof tripsTable.$inferInsert;
