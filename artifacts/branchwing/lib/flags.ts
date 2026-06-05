/**
 * Feature flags.
 *
 * USE_SEEDED_FLIGHTS gates the real Amadeus-seeded popular-route data
 * (`lib/seededRoutes.generated.ts`). It is the single boundary between the two
 * data worlds:
 *
 *   ON  — popular routes, their flight lists, and their cheapest-price anchor
 *         come from the real seeded snapshot. Date-specific flight *search*
 *         (the add-segment flow) deliberately stays on the synthetic catalog,
 *         because the seed is a single-date snapshot and can't answer an
 *         arbitrary user-chosen date. See services/api.ts and
 *         app/search-flights.tsx.
 *   OFF — every surface falls back to the synthetic catalog
 *         (`lib/flightSearch` + `lib/priceHistory`), which keeps the whole app
 *         internally consistent (no real-vs-synthetic price mismatch).
 *
 * Flip it at runtime with EXPO_PUBLIC_USE_SEEDED_FLIGHTS ("0"/"false"/"off" to
 * disable, anything else to enable), or change the default below.
 */

const DEFAULT_USE_SEEDED_FLIGHTS = true;

function envFlag(name: string, fallback: boolean): boolean {
  const raw =
    typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (raw == null || raw === "") return fallback;
  return !["0", "false", "off", "no"].includes(raw.toLowerCase());
}

export const USE_SEEDED_FLIGHTS = envFlag(
  "EXPO_PUBLIC_USE_SEEDED_FLIGHTS",
  DEFAULT_USE_SEEDED_FLIGHTS,
);
