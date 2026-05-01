import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable(
  "user_profiles",
  {
    clerkUserId: text("clerk_user_id").primaryKey(),
    handle: text("handle").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    handleLowerUnique: uniqueIndex("user_profiles_handle_lower_unique").on(
      sql`lower(${t.handle})`,
    ),
  }),
);

export type UserProfileRow = typeof userProfilesTable.$inferSelect;
export type InsertUserProfileRow = typeof userProfilesTable.$inferInsert;
