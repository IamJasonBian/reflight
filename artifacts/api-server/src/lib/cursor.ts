// Discover-feed pagination cursor.
//
// Format: `<isoTimestamp>|<userId>|<tripId>`. Tie-breaking on (userId, id)
// — the trips primary key — makes the sort provably total even in the
// worst-case nanoid collision across users. Legacy `<iso>|<id>` cursors
// are still accepted (userId left empty) so older clients don't 400.
// Bad cursors are treated as "no cursor".
//
// Kept dependency-free (only Date) so it can be unit-tested without pulling
// in the DB pool that `@workspace/db` opens at import time.
export function parseCursor(
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

export function encodeCursor(
  updatedAt: Date,
  userId: string,
  id: string,
): string {
  return `${updatedAt.toISOString()}|${userId}|${id}`;
}
