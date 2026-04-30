/**
 * API service layer.
 *
 * Mirrors the route-manager `services/api.ts` abstraction. Today the data is
 * served from the local synthetic catalog so the app is fully functional
 * offline. When NETLIFY_AUTH_TOKEN is provisioned and an upstream Amadeus
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
import type { RouteMeta, RoutePriceHistory } from "@/lib/types";

export type ApiSource = "local" | "remote";

export const API_SOURCE: ApiSource =
  typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_BASE
    ? "remote"
    : "local";

export async function fetchFlights(
  params: SearchParams,
): Promise<FlightOption[]> {
  // Local-first; the remote branch would call the Netlify proxy:
  //   const r = await fetch(`${API_BASE}/.netlify/functions/search-flights`, ...)
  return localSearchFlights(params);
}

export async function fetchPopularRoutes(): Promise<RouteMeta[]> {
  return [...DEFAULT_ROUTES].sort((a, b) => b.popularity - a.popularity);
}

export async function fetchPriceHistory(
  fromCode: string,
  toCode: string,
  basePrice?: number,
): Promise<RoutePriceHistory> {
  return buildPriceHistory(fromCode, toCode, basePrice);
}
