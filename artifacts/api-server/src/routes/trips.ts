import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, tripsTable } from "@workspace/db";
import {
  ListTripsResponse,
  ReplaceTripsBody,
  ReplaceTripsResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/requireAuth";
import { ensureUserProfile } from "../lib/userProfile";

const router: IRouter = Router();

router.get("/trips", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;

  const rows = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.userId, userId));

  // Make sure the boolean column wins over a stale `isPublic` inside the
  // JSON payload — that way the client always sees the source of truth
  // even if an older client wrote a payload with no `isPublic` field set.
  const trips = rows.map((row) => ({
    ...(row.payload as Record<string, unknown>),
    isPublic: row.isPublic,
  }));
  const data = ListTripsResponse.parse(trips);
  res.json(data);
});

router.put("/trips", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;

  const bodyParse = ReplaceTripsBody.safeParse(req.body);
  if (!bodyParse.success) {
    req.log.warn(
      { errors: bodyParse.error.message },
      "invalid replaceTrips body",
    );
    res.status(400).json({ error: bodyParse.error.message });
    return;
  }
  const { trips } = bodyParse.data;

  const publicCount = trips.filter((t) => t.isPublic === true).length;

  // If this PUT contains *any* public trip we have to make sure the author
  // has a `user_profiles` row before the rows land — otherwise the inner
  // join in `/discover/trips` would silently drop them. We do this before
  // the trips transaction so that on profile-creation failure no public
  // trip ends up persisted that wouldn't be discoverable.
  if (publicCount > 0) {
    try {
      await ensureUserProfile(userId, () => fetchPrimaryEmail(userId));
    } catch (err) {
      // Same reasoning as in /me/profile: never permanently bake a fallback
      // handle just because Clerk was briefly unavailable. Surface the
      // failure as 503; the mobile client's tripsSync layer will retry.
      req.log.warn(
        { userId, err: (err as Error).message },
        "ensureUserProfile failed during PUT /trips; rejecting so client retries",
      );
      res
        .status(503)
        .json({ error: "Could not provision public profile, please retry." });
      return;
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(tripsTable).where(eq(tripsTable.userId, userId));
    if (trips.length > 0) {
      await tx.insert(tripsTable).values(
        trips.map((trip) => ({
          id: trip.id,
          userId,
          // The full trip JSON is the source of truth for everything other
          // than discoverability; we mirror just `isPublic` into its own
          // column so the Discover feed query can be a single indexed scan.
          payload: trip,
          isPublic: trip.isPublic === true,
        })),
      );
    }
  });

  req.log.info(
    { userId, count: trips.length, public: publicCount },
    "replaced trips",
  );
  const data = ReplaceTripsResponse.parse(trips);
  res.json(data);
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

// Hard-delete every trip we hold for this Clerk user. Called from the in-app
// "Delete account" flow so that Branchwing data is purged as soon as the user
// confirms account deletion (App Store Guideline 5.1.1(v)). Clerk itself
// removes the user record on the client side via `useUser().user.delete()`.
router.delete("/trips", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const result = await db
    .delete(tripsTable)
    .where(eq(tripsTable.userId, userId));
  req.log.info({ userId, deleted: result.rowCount ?? 0 }, "purged user trips");
  res.json({ ok: true });
});

export default router;
