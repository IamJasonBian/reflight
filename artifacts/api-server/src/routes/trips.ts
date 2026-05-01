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

  // Boolean column wins over any stale isPublic in the JSON payload.
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

  // Provision the public profile before persisting any public trip so the
  // Discover join can never drop a freshly-public row.
  if (publicCount > 0) {
    try {
      await ensureUserProfile(userId, () => fetchPrimaryEmail(userId));
    } catch (err) {
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

// Hard-delete all trips for this Clerk user (called from the in-app
// account-deletion flow; App Store Guideline 5.1.1(v)).
router.delete("/trips", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const result = await db
    .delete(tripsTable)
    .where(eq(tripsTable.userId, userId));
  req.log.info({ userId, deleted: result.rowCount ?? 0 }, "purged user trips");
  res.json({ ok: true });
});

export default router;
