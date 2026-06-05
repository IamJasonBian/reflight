// Behavioural tests for the synthetic flight catalog
// (branchwing/lib/flightSearch.ts). The catalog is a seeded-PRNG generator,
// so its defining property is *determinism*: identical params must yield
// byte-identical results (the UI caches and diffs on this). We also pin the
// empty-result guards and the pure estimateFlightMinutes math.
//
// NOTE: imports lib/airports.ts transitively; run with `tsx` (CI). On a
// machine where `tsx` can't run, this is the one test that needs it — the
// others run under bare `node`.
import {
  estimateFlightMinutes,
  searchFlights,
  sortFlights,
} from "../../artifacts/branchwing/lib/flightSearch.ts";

const failures: string[] = [];
function check(label: string, cond: boolean): void {
  if (!cond) failures.push(label);
}

// --- estimateFlightMinutes (pure) -------------------------------------------
check(`estimate(525mi)=90, got ${estimateFlightMinutes(525)}`, estimateFlightMinutes(525) === 90);
check(`estimate(0mi)=30, got ${estimateFlightMinutes(0)}`, estimateFlightMinutes(0) === 30);

// --- empty-result guards ----------------------------------------------------
const params = { originCode: "JFK", destCode: "CDG", date: "2026-06-03" };
check("same origin/dest → []", searchFlights({ ...params, destCode: "JFK" }).length === 0);
check("unknown airport → []", searchFlights({ ...params, originCode: "ZZZ" }).length === 0);

// --- determinism ------------------------------------------------------------
const a = searchFlights(params);
const b = searchFlights(params);
check("returns a non-empty itinerary for a real route", a.length > 0);
check(
  `identical params → identical results (${a.length} vs ${b.length} flights)`,
  JSON.stringify(a) === JSON.stringify(b),
);

// --- structural invariants on a real route ----------------------------------
check("flight count in [5,7]", a.length >= 5 && a.length <= 7);
check(
  "every flight is on the requested route with sane fields",
  a.every(
    (f) =>
      f.fromCode === "JFK" &&
      f.toCode === "CDG" &&
      (f.stops === 0 || f.stops === 1) &&
      f.price > 0 &&
      new Date(f.arrive).getTime() > new Date(f.depart).getTime(),
  ),
);

// --- sortFlights doesn't mutate and orders correctly ------------------------
const byPrice = sortFlights(a, "price");
check("sortFlights returns a new array", byPrice !== a);
check("original order preserved (no mutation)", JSON.stringify(a) === JSON.stringify(b));
check(
  "price sort is ascending",
  byPrice.every((f, i) => i === 0 || byPrice[i - 1].price <= f.price),
);
const byDuration = sortFlights(a, "duration");
check(
  "duration sort is ascending",
  byDuration.every((f, i) => i === 0 || byDuration[i - 1].durationMin <= f.durationMin),
);

if (failures.length > 0) {
  console.error("FAIL: flightSearch regressed:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("PASS: flightSearch — determinism, empty guards, structure, sort");
