import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Trip } from "./types";

const PREFIX = "branchwing.trips.v3.";
const LEGACY_KEY = "branchwing.trips.v2";

function userKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

/**
 * Load trips for the given Clerk user from on-device cache.
 *
 * Storage is scoped per Clerk userId so that multiple accounts on the same
 * device cannot see each other's trips even momentarily before the server
 * reconciles.
 */
export async function loadTrips(userId: string): Promise<Trip[]> {
  try {
    const raw = await AsyncStorage.getItem(userKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Trip[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveTrips(userId: string, trips: Trip[]): Promise<void> {
  await AsyncStorage.setItem(userKey(userId), JSON.stringify(trips));
}

/**
 * Best-effort cleanup of pre-auth single-bucket cache from older builds.
 * Called once on first authenticated load.
 */
export async function dropLegacyCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

/**
 * Drop the cached trips for a specific Clerk userId — used by the
 * "Delete account" flow before signing the user out.
 */
export async function dropUserCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(userKey(userId));
  } catch {
    // ignore
  }
}
