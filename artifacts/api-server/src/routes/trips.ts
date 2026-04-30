import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tripsTable } from "@workspace/db";
import {
  ListTripsHeader,
  ListTripsResponse,
  ReplaceTripsBody,
  ReplaceTripsHeader,
  ReplaceTripsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips", async (req, res): Promise<void> => {
  const headerParse = ListTripsHeader.safeParse({
    "X-Client-Id": req.header("x-client-id"),
  });
  if (!headerParse.success) {
    req.log.warn({ errors: headerParse.error.message }, "missing X-Client-Id");
    res.status(400).json({ error: "X-Client-Id header is required" });
    return;
  }
  const clientId = headerParse.data["X-Client-Id"];

  const rows = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.clientId, clientId));

  const trips = rows.map((row) => row.payload);
  const data = ListTripsResponse.parse(trips);
  res.json(data);
});

router.put("/trips", async (req, res): Promise<void> => {
  const headerParse = ReplaceTripsHeader.safeParse({
    "X-Client-Id": req.header("x-client-id"),
  });
  if (!headerParse.success) {
    req.log.warn({ errors: headerParse.error.message }, "missing X-Client-Id");
    res.status(400).json({ error: "X-Client-Id header is required" });
    return;
  }
  const clientId = headerParse.data["X-Client-Id"];

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
    await tx.delete(tripsTable).where(eq(tripsTable.clientId, clientId));
    if (trips.length > 0) {
      await tx.insert(tripsTable).values(
        trips.map((trip) => ({
          id: trip.id,
          clientId,
          payload: trip,
        })),
      );
    }
  });

  req.log.info({ clientId, count: trips.length }, "replaced trips");
  const data = ReplaceTripsResponse.parse(trips);
  res.json(data);
});

export default router;
