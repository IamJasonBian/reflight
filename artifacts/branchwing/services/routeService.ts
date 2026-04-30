import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SavedRoute } from "@/lib/types";

const KEY = "branchwing.savedRoutes.v1";

export async function loadSavedRoutes(): Promise<SavedRoute[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRoute[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSavedRoutes(routes: SavedRoute[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(routes));
  } catch {
    // ignore
  }
}

export function routeId(fromCode: string, toCode: string): string {
  return `${fromCode}-${toCode}`;
}
