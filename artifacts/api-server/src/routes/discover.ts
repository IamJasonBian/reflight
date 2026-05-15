import { Router, type IRouter } from "express";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { db, tripsTable, userProfilesTable } from "@workspace/db";
import {
  DiscoverTripsQueryParams,
  DiscoverTripsResponse,
  GetPublicProfileParams,
  GetPublicProfileResponse,
  GetPublicTripParams,
  GetPublicTripResponse,
} from "@workspace/api-zod";
import { getOptionalUserId } from "../lib/requireAuth";

const router: IRouter = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Cursor: `<isoTimestamp>|<userId>|<tripId>`. Tie-breaking on (userId, id)
// — the trips primary key — makes the sort provably total even in the
// worst-case nanoid collision across users. Legacy `<iso>|<id>` cursors
// are still accepted (userId left empty) so older clients don't 400.
// Bad cursors are treated as "no cursor".
function parseCursor(
  raw: string | undefined,
): { updatedAt: Date; userId: string; id: string } | undefined {
  if (!raw) return undefined;
  const parts = raw.split("|");
  if (parts.length < 2 || parts.length > 3) return undefined;
  const ts = parts[0];
  if (!ts) return undefined;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return undefined;
  if (parts.length === 3) {
    const userId = parts[1];
    const id = parts[2];
    if (!id) return undefined;
    return { updatedAt: d, userId, id };
  }
  // Legacy 2-part cursor: no userId tie-break, leave empty.
  const id = parts[1];
  if (!id) return undefined;
  return { updatedAt: d, userId: "", id };
}

function encodeCursor(updatedAt: Date, userId: string, id: string): string {
  return `${updatedAt.toISOString()}|${userId}|${id}`;
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
  const viewerId = getOptionalUserId(req);

  // Truncate updatedAt to ms so the cursor (which round-trips through a JS
  // Date) and the ORDER BY use the exact same key — otherwise sub-ms
  // microseconds in Postgres can desync row order from page boundaries.
  // The `AT TIME ZONE 'UTC'` cast makes the date_trunc call IMMUTABLE,
  // matching the partial expression index `trips_public_feed_expr_idx`.
  const updatedAtMs = sql`date_trunc('milliseconds', ${tripsTable.updatedAt} AT TIME ZONE 'UTC')`;

  const baseConds = [eq(tripsTable.isPublic, true)];
  if (viewerId) {
    baseConds.push(ne(tripsTable.userId, viewerId));
  }
  if (after) {
    if (after.userId) {
      // New 3-part cursor: total order on (updatedAtMs, user_id, id) DESC.
      baseConds.push(
        or(
          sql`${updatedAtMs} < ${after.updatedAt}`,
          and(
            sql`${updatedAtMs} = ${after.updatedAt}`,
            sql`${tripsTable.userId} < ${after.userId}`,
          ),
          and(
            sql`${updatedAtMs} = ${after.updatedAt}`,
            sql`${tripsTable.userId} = ${after.userId}`,
            sql`${tripsTable.id} < ${after.id}`,
          ),
        )!,
      );
    } else {
      // Legacy 2-part cursor: tie-break on id only. Slightly weaker but
      // backward-compatible for older clients mid-paginate.
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
  }

  const rows = await db
    .select({
      id: tripsTable.id,
      userId: tripsTable.userId,
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
    .orderBy(
      sql`${updatedAtMs} desc`,
      desc(tripsTable.userId),
      desc(tripsTable.id),
    )
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor(last.updatedAt, last.userId, last.id)
      : null;

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
