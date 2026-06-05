/**
 * API service layer.
 *
 * Popular routes are seeded with REAL Amadeus flight offers (see
 * `lib/seededRoutes.generated.ts`, produced by
 * `scripts/src/seed-popular-routes.ts`). For those routes we serve the seeded
 * flights and their real cheapest price. For any other (arbitrary) route we
 * fall back to the local synthetic catalog so the app stays fully functional
 * offline. When EXPO_PUBLIC_API_BASE is provisioned and an upstream Amadeus
 * proxy (Netlify function) is wired up, the implementations below can swap
 * `fetch(...)` calls in without touching any UI code.
 */

import {
  searchFlights as localSearchFlights,
  type FlightOption,
  type SearchParams,
} from "@/lib/flightSearch";
import { buildPriceHistory } from "@/lib/priceHistory";
import { DEFAULT_ROUTES } from "@/lib/defaultRoutes";
import {
  getSeededRoute,
  hasSeededRoutes,
  seededRouteMetas,
} from "@/lib/seededRoutes";
import type { RouteMeta, RoutePriceHistory } from "@/lib/types";

export type ApiSource = "local" | "remote";

export const API_SOURCE: ApiSource =
  typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_BASE
    ? "remote"
    : "local";

export async function fetchFlights(
  params: SearchParams,
): Promise<FlightOption[]> {
  // Popular routes are seeded with real Amadeus offers; serve those directly.
  const seeded = getSeededRoute(params.originCode, params.destCode);
  if (seeded && seeded.flights.length > 0) {
    return seeded.flights;
  }
  // Otherwise fall back to the local synthetic catalog. The remote branch would
  // call the Netlify proxy:
  //   const r = await fetch(`${API_BASE}/.netlify/functions/search-flights`, ...)
  return localSearchFlights(params);
}

export async function fetchPopularRoutes(): Promise<RouteMeta[]> {
  // Prefer the seeded routes (real cheapest price). Merge in any DEFAULT_ROUTES
  // that weren't seeded so the list never shrinks if a route returns no offers.
  const seeded = seededRouteMetas();
  if (!hasSeededRoutes()) {
    return [...DEFAULT_ROUTES].sort((a, b) => b.popularity - a.popularity);
  }
  const seededKeys = new Set(seeded.map((r) => `${r.fromCode}-${r.toCode}`));
  const merged = [
    ...seeded,
    ...DEFAULT_ROUTES.filter(
      (r) => !seededKeys.has(`${r.fromCode}-${r.toCode}`),
    ),
  ];
  return merged.sort((a, b) => b.popularity - a.popularity);
}

export async function fetchPriceHistory(
  fromCode: string,
  toCode: string,
  basePrice?: number,
): Promise<RoutePriceHistory> {
  // Anchor the synthetic 90-day history on the real seeded price when we have
  // one, so the chart and "today" figure line up with the seeded offers.
  const seeded = getSeededRoute(fromCode, toCode);
  return buildPriceHistory(fromCode, toCode, seeded?.basePrice ?? basePrice);
}
