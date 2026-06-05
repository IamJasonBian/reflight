// Behavioural tests for the Discover-feed pagination cursor
// (api-server/lib/cursor.ts). The encode/parse pair must round-trip exactly
// and reject malformed input so a bad cursor degrades to "first page"
// rather than a 400 or a desynced sort.
import {
  encodeCursor,
  parseCursor,
} from "../../artifacts/api-server/src/lib/cursor.ts";

const failures: string[] = [];
function check(label: string, cond: boolean): void {
  if (!cond) failures.push(label);
}

// --- round-trip (3-part) ----------------------------------------------------
const ts = new Date("2026-06-03T12:34:56.789Z");
const encoded = encodeCursor(ts, "user_abc", "trip_xyz");
check(`encode shape, got "${encoded}"`, encoded === "2026-06-03T12:34:56.789Z|user_abc|trip_xyz");

const parsed = parseCursor(encoded);
check("3-part parses", parsed !== undefined);
check(
  "3-part round-trips updatedAt",
  parsed?.updatedAt.getTime() === ts.getTime(),
);
check("3-part round-trips userId", parsed?.userId === "user_abc");
check("3-part round-trips id", parsed?.id === "trip_xyz");

// --- legacy 2-part (no userId tie-break) ------------------------------------
const legacy = parseCursor("2026-06-03T12:34:56.789Z|trip_old");
check("legacy 2-part parses", legacy !== undefined);
check("legacy userId is empty", legacy?.userId === "");
check("legacy id is the second field", legacy?.id === "trip_old");

// --- malformed → undefined (treated as "no cursor") -------------------------
check("undefined input", parseCursor(undefined) === undefined);
check("empty string", parseCursor("") === undefined);
check("single field (no id)", parseCursor("2026-06-03T12:34:56.789Z") === undefined);
check("too many parts", parseCursor("a|b|c|d") === undefined);
check("bad timestamp", parseCursor("not-a-date|user|trip") === undefined);
check("empty timestamp", parseCursor("|user|trip") === undefined);
check("3-part with empty id", parseCursor("2026-06-03T12:34:56.789Z|user|") === undefined);
check("2-part with empty id", parseCursor("2026-06-03T12:34:56.789Z|") === undefined);

if (failures.length > 0) {
  console.error("FAIL: discover cursor regressed:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("PASS: discover cursor — 3-part round-trip, legacy 2-part, malformed rejection");
