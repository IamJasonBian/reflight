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

/**
 * Cursor format: `<isoTimestamp>|<tripId>`. Both fields are required so the
 * pagination is deterministic when many public trips share the same
 * `updated_at` (the seed-trip case in particular). Stale or malformed
 * cursors are silently ignored — we'd rather show the first page than
 * 400 on an old client build.
 *
 * The composite index `trips_public_feed_idx` already covers
 * `(is_public, updated_at desc, id desc)` so this scan stays cheap.
 */
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

  // Inner-join against user_profiles so trips authored by users who have
  // never hit /me/profile (and therefore have no handle yet) silently skip
  // the feed — there'd be no way to render them anyway. New flow on the
  // server side ensures a profile always exists before a trip can become
  // public, so this should never silently drop rows in practice.
  // Both the cursor boundary and the ORDER BY MUST operate on the same
  // sort key, otherwise two rows in the same millisecond bucket but with
  // different microseconds can end up ordered one way at the row level and
  // a different way at the page boundary — which silently skips rows
  // across page transitions.
  //
  // We use millisecond-truncated `updated_at` because that's the precision
  // we can faithfully round-trip through `Date.toISOString()` in the
  // cursor. Postgres `timestamptz` keeps microseconds but a JS Date does
  // not. The composite index `(is_public, updated_at desc, id desc)`
  // still serves the `is_public = true` predicate cheaply; for the
  // current dataset size (<10k public trips) the residual ordering is a
  // trivial in-memory sort.
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

  // Same inner-join shape as the feed query so we never return a row whose
  // author has no profile. We treat "no row" and "private trip" identically
  // (404) so a stranger can't probe whether a private trip with a given id
  // exists at all.
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
  // Handle lookup is case-insensitive — handles are stored lowercased,
  // so just lowercase the request and compare directly.
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
