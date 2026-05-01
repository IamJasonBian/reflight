import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { deriveHandle } from "./handle";

const HANDLE_COLLISION_RETRIES = 25;
const PG_UNIQUE_VIOLATION = "23505";

export interface EnsuredProfile {
  handle: string;
  createdAt: Date;
}

// Get-or-create the public profile for a Clerk user. Race-safe: a unique
// violation triggers a re-read (concurrent insert for same user) or a
// suffix bump (handle taken by someone else). `getEmail` is a thunk so the
// fast path skips the Clerk round-trip; it must throw on transient Clerk
// failures so we never persist a fallback handle from an empty email.
export async function ensureUserProfile(
  clerkUserId: string,
  getEmail: () => Promise<string>,
): Promise<EnsuredProfile> {
  const existing = await readProfile(clerkUserId);
  if (existing) return existing;

  const email = await getEmail();
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
