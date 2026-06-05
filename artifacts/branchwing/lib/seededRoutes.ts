/**
 * Accessor over the Amadeus-seeded popular routes.
 *
 * `seededRoutes.generated.ts` is produced by
 * `scripts/src/seed-popular-routes.ts` and holds a snapshot of real flight
 * offers for each of branchwing's DEFAULT_ROUTES. This module wraps that data
 * with lookups so the service layer can prefer real flights for popular routes
 * and fall back to the synthetic catalog for everything else.
 */

import type { FlightOption } from "./flightSearch";
import type { RouteMeta } from "./types";
import {
  SEEDED_DEPARTURE_DATE,
  SEEDED_GENERATED_AT,
  SEEDED_ROUTES,
} from "./seededRoutes.generated";

export type SeededRoute = {
  fromCode: string;
  toCode: string;
  basePrice: number;
  popularity: number;
  flights: FlightOption[];
};

export { SEEDED_DEPARTURE_DATE, SEEDED_GENERATED_AT };

const routeKey = (fromCode: string, toCode: string) => `${fromCode}-${toCode}`;

const byKey = new Map<string, SeededRoute>(
  SEEDED_ROUTES.map((r) => [routeKey(r.fromCode, r.toCode), r]),
);

export function hasSeededRoutes(): boolean {
  return SEEDED_ROUTES.length > 0;
}

export function getSeededRoute(
  fromCode: string,
  toCode: string,
): SeededRoute | null {
  return byKey.get(routeKey(fromCode, toCode)) ?? null;
}

/** Route metadata (without flight lists) for the popular-routes list. */
export function seededRouteMetas(): RouteMeta[] {
  return SEEDED_ROUTES.map(({ fromCode, toCode, basePrice, popularity }) => ({
    fromCode,
    toCode,
    basePrice,
    popularity,
  }));
}
