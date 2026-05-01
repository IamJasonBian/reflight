import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { deriveHandle } from "./handle";

const HANDLE_COLLISION_RETRIES = 25;
const PG_UNIQUE_VIOLATION = "23505";

export interface EnsuredProfile {
  handle: string;
  createdAt: Date;
}

/**
 * Get-or-create the public profile for a Clerk user, idempotently and
 * race-safely. Two concurrent first-callers for the same `clerkUserId`
 * will both end up returning the same row instead of one of them blowing
 * past the handle-retry budget.
 *
 * Strategy:
 *   1. Read first — by far the common path after the first call.
 *   2. If missing, derive a candidate handle from the (eagerly-fetched)
 *      email and attempt an INSERT. We treat the unique-violation error
 *      code (`23505`) as one of two distinct cases:
 *        a) `clerk_user_id` collided → the row was just created by another
 *           in-flight request for *this same user*; re-read and return it.
 *        b) `handle` collided → bump the suffix (`base2`, `base3`, …) and
 *           try again, up to HANDLE_COLLISION_RETRIES.
 *      Postgres doesn't expose *which* unique index was hit in the error
 *      payload uniformly across drivers, so we re-check the row's
 *      existence on every 23505 — that's both cheap and unambiguous.
 *
 * `getEmail` is a thunk so the fast path (profile already exists) doesn't
 * pay for a Clerk API round-trip. CRITICAL: the thunk MUST throw on
 * transient Clerk failures (do not swallow and return `""`). The handle
 * is derived from the email and persisted forever on first write — if we
 * accept an empty email we'll permanently assign the user a `user_<hash>`
 * fallback handle even though their real email was just temporarily
 * unreachable. Better to bubble the error: the next call (after Clerk
 * recovers) will derive the real handle and succeed.
 */
export async function ensureUserProfile(
  clerkUserId: string,
  getEmail: () => Promise<string>,
): Promise<EnsuredProfile> {
  const existing = await readProfile(clerkUserId);
  if (existing) return existing;

  const email = await getEmail();
  // Defense in depth — even if a future caller passes a thunk that
  // accidentally returns "" without throwing, refuse rather than silently
  // baking a fallback handle into the row forever. The route handler
  // above this should map the thrown error to a 503 so the client can
  // retry; on retry the email is usually available.
  if (!email || email.trim().length === 0) {
    throw new Error(
      "ensureUserProfile: empty email; refusing to persist a fallback handle for clerkUserId=" +
        clerkUserId,
    );
  }
  const base = deriveHandle(email, clerkUserId);

  for (let suffix = 0; suffix < HANDLE_COLLISION_RETRIES; suffix++) {
    const handle = suffix === 0 ? base : `${base}${suffix + 1}`;
    try {
      const [row] = await db
        .insert(userProfilesTable)
        .values({ clerkUserId, handle, email })
        .returning();
      return { handle: row.handle, createdAt: row.createdAt };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== PG_UNIQUE_VIOLATION) throw err;

      // Disambiguate: did *our* row get created concurrently, or did the
      // handle simply belong to someone else? Re-read; if our row now
      // exists, return it. Otherwise the conflict was on `handle` and we
      // should retry with a bumped suffix.
      const raced = await readProfile(clerkUserId);
      if (raced) return raced;
    }
  }
  throw new Error(
    `Could not allocate a unique handle after ${HANDLE_COLLISION_RETRIES} tries`,
  );
}

async function readProfile(
  clerkUserId: string,
): Promise<EnsuredProfile | null> {
  const rows = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  if (rows.length === 0) return null;
  return { handle: rows[0].handle, createdAt: rows[0].createdAt };
}
