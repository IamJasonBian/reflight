import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, tripsTable } from "@workspace/db";
import {
  ListTripsResponse,
  ReplaceTripsBody,
  ReplaceTripsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type AuthedRequest = Request & { userId?: string };

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId =
    (auth?.sessionClaims as { userId?: string } | undefined)?.userId ||
    auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

router.get("/trips", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;

  const rows = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.userId, userId));

  const trips = rows.map((row) => row.payload);
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

  await db.transaction(async (tx) => {
    await tx.delete(tripsTable).where(eq(tripsTable.userId, userId));
    if (trips.length > 0) {
      await tx.insert(tripsTable).values(
        trips.map((trip) => ({
          id: trip.id,
          userId,
          payload: trip,
        })),
      );
    }
  });

  req.log.info({ userId, count: trips.length }, "replaced trips");
  const data = ReplaceTripsResponse.parse(trips);
  res.json(data);
});

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
