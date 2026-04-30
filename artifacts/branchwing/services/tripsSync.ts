/**
 * Trip persistence sync layer.
 *
 * The app keeps an offline-first AsyncStorage cache, and mirrors that data to
 * the Replit-hosted API server (artifacts/api-server) so trips are durable
 * across reinstalls and (eventually) across devices.
 *
 * - Source of truth on the device: AsyncStorage
 * - Source of truth across devices: the API server
 * - On launch we hydrate from AsyncStorage immediately, then opportunistically
 *   pull from the server. If the server has trips, they replace local state
 *   (the server always reflects the latest write).
 * - On every change we PUT the full list back to the server (debounced).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Trip } from "@/lib/types";
import { genId } from "@/lib/time";

const CLIENT_ID_KEY = "branchwing.clientId.v1";

function resolveApiBase(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit && explicit.length > 0) {
    return explicit.replace(/\/$/, "");
  }
  const dev = process.env.EXPO_PUBLIC_DOMAIN;
  if (dev && dev.length > 0) {
    return `https://${dev}/api`;
  }
  return "/api";
}

export const API_BASE = resolveApiBase();

let cachedClientId: string | null = null;

export async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  const existing = await AsyncStorage.getItem(CLIENT_ID_KEY);
  if (existing && existing.length > 0) {
    cachedClientId = existing;
    return existing;
  }
  const created = `${genId()}-${genId()}`;
  await AsyncStorage.setItem(CLIENT_ID_KEY, created);
  cachedClientId = created;
  return created;
}

async function authedHeaders(): Promise<Record<string, string>> {
  const clientId = await getClientId();
  return {
    "Content-Type": "application/json",
    "X-Client-Id": clientId,
  };
}

export async function fetchRemoteTrips(): Promise<Trip[] | null> {
  try {
    const headers = await authedHeaders();
    const res = await fetch(`${API_BASE}/trips`, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as Trip[];
    if (!Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function pushRemoteTrips(trips: Trip[]): Promise<boolean> {
  try {
    const headers = await authedHeaders();
    const res = await fetch(`${API_BASE}/trips`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ trips }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
