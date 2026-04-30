import {
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
    clientId: text("client_id").notNull(),
    payload: jsonb("payload").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.clientId, t.id] }),
  }),
);

export type TripRow = typeof tripsTable.$inferSelect;
export type InsertTripRow = typeof tripsTable.$inferInsert;
