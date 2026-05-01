import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Public profile for a Branchwing user. Created lazily on the first
 * authenticated API call after sign-in. The `handle` is derived from the
 * user's primary email's local part (see `deriveHandle` in the api-server
 * profile route) and stored *always lowercased* so that a plain unique
 * constraint is effectively case-insensitive.
 *
 * The Clerk user record remains the source of truth for identity and email;
 * this table only stores the public-facing handle that other users see in
 * the Discover feed.
 */
export const userProfilesTable = pgTable("user_profiles", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  handle: text("handle").notNull().unique(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserProfileRow = typeof userProfilesTable.$inferSelect;
export type InsertUserProfileRow = typeof userProfilesTable.$inferInsert;
