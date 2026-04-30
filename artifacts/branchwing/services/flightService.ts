/**
 * Thin facade over the synthetic flight catalog. Exists to mirror the
 * route-manager `services/` layer and to give the rest of the app a single
 * import surface. When the live Amadeus path comes online, swap the body of
 * each function for a call into `services/api.ts`.
 */

import {
  estimateFlightMinutes,
  searchFlights,
  sortFlights,
  type FlightOption,
  type SearchParams,
  type SortMode,
} from "@/lib/flightSearch";

export type { FlightOption, SearchParams, SortMode };
export { estimateFlightMinutes, searchFlights, sortFlights };

export function searchAndSort(
  params: SearchParams,
  sort: SortMode,
): FlightOption[] {
  return sortFlights(searchFlights(params), sort);
}
