/**
 * Runtime validity checks.
 *
 * Flights and trips are seeded/saved with concrete dates that eventually fall
 * into the past — a seeded popular-route offer for next month is stale once
 * that month passes, and a saved trip can simply have departed. Rather than
 * mutate stored data, we flag staleness at read time by comparing against
 * `now`. (A richer validation + booking-consistency service is planned later;
 * this is the simple "is it in the past?" check.)
 */

import type { Trip } from "./types";

/** True when `iso` is a valid timestamp that is strictly before `now`. */
export function isPast(iso: string, now: number = Date.now()): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < now;
}

export type FlightValidity = "upcoming" | "departed";

export function flightValidity(
  flight: { depart: string },
  now: number = Date.now(),
): FlightValidity {
  return isPast(flight.depart, now) ? "departed" : "upcoming";
}

export type TripStatus = "upcoming" | "in-progress" | "past" | "empty";

export type TripValidity = {
  status: TripStatus;
  /** number of segments (across all branches) that have already departed */
  departedCount: number;
  /** total number of segments across all branches */
  totalSegments: number;
};

/**
 * Classify a trip by how many of its segments have departed. A trip with no
 * future segments is "past"; one mid-journey is "in-progress".
 */
export function tripValidity(
  trip: Trip,
  now: number = Date.now(),
): TripValidity {
  const departs = trip.branches.flatMap((b) => b.segments.map((s) => s.depart));
  const totalSegments = departs.length;
  if (totalSegments === 0) {
    return { status: "empty", departedCount: 0, totalSegments: 0 };
  }
  const departedCount = departs.filter((d) => isPast(d, now)).length;
  const status: TripStatus =
    departedCount === 0
      ? "upcoming"
      : departedCount === totalSegments
        ? "past"
        : "in-progress";
  return { status, departedCount, totalSegments };
}
