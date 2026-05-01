import { Router, type IRouter } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db, tripsTable, userProfilesTable } from "@workspace/db";
import {
  DiscoverTripsQueryParams,
  DiscoverTripsResponse,
  GetPublicProfileParams,
  GetPublicProfileResponse,
  GetPublicTripParams,
  GetPublicTripResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Cursor: `<isoTimestamp>|<tripId>`. Tie-break on id keeps pages stable
// when multiple public trips share the same updatedAt. Bad cursors are
// treated as "no cursor" so old clients don't 400.
function parseCursor(
  raw: string | undefined,
): { updatedAt: Date; id: string } | undefined {
  if (!raw) return undefined;
  const sep = raw.indexOf("|");
  if (sep <= 0) return undefined;
  const ts = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  if (!id) return undefined;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return undefined;
  return { updatedAt: d, id };
}

function encodeCursor(updatedAt: Date, id: string): string {
  return `${updatedAt.toISOString()}|${id}`;
}

router.get("/discover/trips", async (req, res): Promise<void> => {
  const queryParse = DiscoverTripsQueryParams.safeParse(req.query);
  if (!queryParse.success) {
    res.status(400).json({ error: queryParse.error.message });
    return;
  }
  const { cursor, limit: rawLimit } = queryParse.data;
  const limit = Math.min(rawLimit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const after = parseCursor(cursor);

  // Truncate updatedAt to ms so the cursor (which round-trips through a JS
  // Date) and the ORDER BY use the exact same key — otherwise sub-ms
  // microseconds in Postgres can desync row order from page boundaries.
  const updatedAtMs = sql`date_trunc('milliseconds', ${tripsTable.updatedAt})`;

  const baseConds = [eq(tripsTable.isPublic, true)];
  if (after) {
    baseConds.push(
      or(
        sql`${updatedAtMs} < ${after.updatedAt}`,
        and(
          sql`${updatedAtMs} = ${after.updatedAt}`,
          sql`${tripsTable.id} < ${after.id}`,
        ),
      )!,
    );
  }

  const rows = await db
    .select({
      id: tripsTable.id,
      payload: tripsTable.payload,
      updatedAt: tripsTable.updatedAt,
      handle: userProfilesTable.handle,
    })
    .from(tripsTable)
    .innerJoin(
      userProfilesTable,
      eq(userProfilesTable.clerkUserId, tripsTable.userId),
    )
    .where(and(...baseConds))
    .orderBy(sql`${updatedAtMs} desc`, desc(tripsTable.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(last.updatedAt, last.id) : null;

  const data = DiscoverTripsResponse.parse({
    items: page.map((r) => ({
      trip: r.payload,
      author: { handle: r.handle },
      updatedAt: r.updatedAt.toISOString(),
    })),
    nextCursor,
  });
  res.json(data);
});

router.get("/discover/trips/:id", async (req, res): Promise<void> => {
  const paramsParse = GetPublicTripParams.safeParse(req.params);
  if (!paramsParse.success) {
    res.status(400).json({ error: paramsParse.error.message });
    return;
  }
  const { id } = paramsParse.data;

  // 404 covers both "no row" and "private trip" so callers can't probe
  // whether a private trip exists by id.
  const rows = await db
    .select({
      payload: tripsTable.payload,
      updatedAt: tripsTable.updatedAt,
      handle: userProfilesTable.handle,
    })
    .from(tripsTable)
    .innerJoin(
      userProfilesTable,
      eq(userProfilesTable.clerkUserId, tripsTable.userId),
    )
    .where(and(eq(tripsTable.id, id), eq(tripsTable.isPublic, true)))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const row = rows[0];
  const data = GetPublicTripResponse.parse({
    trip: row.payload,
    author: { handle: row.handle },
    updatedAt: row.updatedAt.toISOString(),
  });
  res.json(data);
});

router.get("/users/:handle", async (req, res): Promise<void> => {
  const paramsParse = GetPublicProfileParams.safeParse(req.params);
  if (!paramsParse.success) {
    res.status(400).json({ error: paramsParse.error.message });
    return;
  }
  const handle = paramsParse.data.handle.toLowerCase();

  const profileRows = await db
    .select()
    .from(userProfilesTable)
    .where(eq(sql`lower(${userProfilesTable.handle})`, handle))
    .limit(1);

  if (profileRows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const profile = profileRows[0];

  const tripRows = await db
    .select({
      payload: tripsTable.payload,
      updatedAt: tripsTable.updatedAt,
    })
    .from(tripsTable)
    .where(
      and(
        eq(tripsTable.userId, profile.clerkUserId),
        eq(tripsTable.isPublic, true),
      ),
    )
    .orderBy(desc(tripsTable.updatedAt));

  const data = GetPublicProfileResponse.parse({
    profile: {
      handle: profile.handle,
      createdAt: profile.createdAt.toISOString(),
    },
    trips: tripRows.map((r) => ({
      trip: r.payload,
      author: { handle: profile.handle },
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
  res.json(data);
});

export default router;
