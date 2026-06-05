// Behavioural tests for the pure helpers in branchwing/lib/time.ts.
// time.ts has zero imports, so we exercise the real functions (no mocks,
// no test runner — a tiny assert harness, consistent with the other
// scripts/src tests). Run with `tsx` (CI) or `node` (local).
import {
  branchHasAnyPrice,
  branchTotalPrice,
  durationMs,
  fmtDuration,
  fmtPrice,
  genId,
} from "../../artifacts/branchwing/lib/time.ts";

const failures: string[] = [];
function check(label: string, cond: boolean): void {
  if (!cond) failures.push(label);
}
function eq(label: string, actual: unknown, expected: unknown): void {
  check(
    `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    actual === expected,
  );
}

// --- genId: `Date.now().toString(36)` + 7 random base36 chars ---------------
const id = genId();
check(`genId is lowercase base36, got "${id}"`, /^[0-9a-z]+$/.test(id));
check(`genId length looks right (>=10), got ${id.length}`, id.length >= 10);
const ids = new Set<string>();
for (let i = 0; i < 5000; i++) ids.add(genId());
check(`genId is ~unique across 5000 calls, got ${ids.size}`, ids.size >= 4995);

// --- fmtPrice ---------------------------------------------------------------
eq("fmtPrice(null)", fmtPrice(null), "—");
eq("fmtPrice(undefined)", fmtPrice(undefined), "—");
eq("fmtPrice(NaN)", fmtPrice(NaN), "—");
eq("fmtPrice(Infinity)", fmtPrice(Infinity), "—");
eq("fmtPrice(0)", fmtPrice(0), "$0");
eq("fmtPrice(685)", fmtPrice(685), "$685");
eq("fmtPrice(685.4 rounds)", fmtPrice(685.4), "$685");
// Stays in whole dollars below 10k. Compare separator-agnostically — the
// thousands separator depends on the runtime's default locale.
eq(
  "fmtPrice(9999) stays in dollars",
  fmtPrice(9999).replace(/,/g, ""),
  "$9999",
);
eq("fmtPrice(10000) switches to k", fmtPrice(10000), "$10.0k");
eq("fmtPrice(12500)", fmtPrice(12500), "$12.5k");

// --- branchTotalPrice / branchHasAnyPrice -----------------------------------
eq("branchTotalPrice([])", branchTotalPrice([]), 0);
eq(
  "branchTotalPrice sums and treats missing price as 0",
  branchTotalPrice([{ price: 100 }, { price: 200 }, {}]),
  300,
);
eq("branchHasAnyPrice([])", branchHasAnyPrice([]), false);
eq(
  "branchHasAnyPrice ignores 0 / missing",
  branchHasAnyPrice([{ price: 0 }, {}]),
  false,
);
eq(
  "branchHasAnyPrice true when any positive",
  branchHasAnyPrice([{ price: 0 }, { price: 5 }]),
  true,
);

// --- fmtDuration ------------------------------------------------------------
eq("fmtDuration(0)", fmtDuration(0), "0m");
eq("fmtDuration(30m)", fmtDuration(30 * 60000), "30m");
eq("fmtDuration(60m)", fmtDuration(60 * 60000), "1h");
eq("fmtDuration(90m)", fmtDuration(90 * 60000), "1h 30m");
eq("fmtDuration rounds to nearest minute", fmtDuration(89.6 * 60000), "1h 30m");

// --- durationMs -------------------------------------------------------------
eq(
  "durationMs computes end - start",
  durationMs("2026-01-01T00:00:00.000Z", "2026-01-01T07:30:00.000Z"),
  7.5 * 3600 * 1000,
);

if (failures.length > 0) {
  console.error("FAIL: lib/time helpers regressed:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  "PASS: lib/time helpers — genId, fmtPrice, branchTotalPrice, " +
    "branchHasAnyPrice, fmtDuration, durationMs",
);
