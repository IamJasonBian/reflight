import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, userProfilesTable } from "@workspace/db";
import { GetMyProfileResponse } from "@workspace/api-zod";
import { ensureUserProfile } from "../lib/userProfile";
import { requireAuth, type AuthedRequest } from "../lib/requireAuth";

const router: IRouter = Router();

router.get("/me/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;

  const existing = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, userId))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    res.json(
      GetMyProfileResponse.parse({
        handle: row.handle,
        createdAt: row.createdAt.toISOString(),
      }),
    );
    return;
  }

  // Don't swallow Clerk errors — fallback handles are permanent. 503 lets
  // the client retry once Clerk recovers.
  try {
    const created = await ensureUserProfile(userId, () =>
      fetchPrimaryEmail(userId),
    );
    req.log.info(
      { userId, handle: created.handle },
      "created public profile on demand",
    );
    res.json(
      GetMyProfileResponse.parse({
        handle: created.handle,
        createdAt: created.createdAt.toISOString(),
      }),
    );
  } catch (err) {
    req.log.warn(
      { userId, err: (err as Error).message },
      "ensureUserProfile failed; client should retry",
    );
    res.status(503).json({ error: "Profile not yet available, please retry." });
  }
});

async function fetchPrimaryEmail(userId: string): Promise<string> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  );
  const email =
    primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";
  if (!email) {
    throw new Error(`Clerk user ${userId} has no email address`);
  }
  return email;
}

export default router;
