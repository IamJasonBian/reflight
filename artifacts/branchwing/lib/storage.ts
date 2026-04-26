import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Trip } from "./types";

const KEY = "branchwing.trips.v2";

export async function loadTrips(): Promise<Trip[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Trip[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(trips));
}
