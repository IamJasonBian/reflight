/**
 * Trip persistence sync layer.
 *
 * The app keeps an offline-first AsyncStorage cache, and mirrors that data to
 * the Replit-hosted API server (artifacts/api-server) so trips are durable
 * across reinstalls and across devices for the signed-in user.
 *
 * - Source of truth on the device: AsyncStorage
 * - Source of truth across devices: the API server (per Clerk userId)
 * - On launch we hydrate from AsyncStorage immediately, then opportunistically
 *   pull from the server. If the server has trips, they replace local state.
 * - On every change we PUT the full list back to the server (debounced).
 *
 * Auth: a Clerk JWT is attached as `Authorization: Bearer <token>`. The token
 * is fetched lazily via a getter installed by the root layout (which has
 * access to Clerk's `useAuth().getToken`).
 */
import type { Trip } from "@/lib/types";

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

type TokenGetter = () => Promise<string | null> | string | null;

let tokenGetter: TokenGetter | null = null;

export function setSyncAuthTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

async function authedHeaders(): Promise<Record<string, string> | null> {
  const token = tokenGetter ? await tokenGetter() : null;
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Wait until the Clerk token is actually available (e.g. on cold start the
// ClerkProvider hasn't finished hydrating its session yet) so the very first
// `fetchRemoteTrips` doesn't return `null` and silently fall back to whatever
// is in the local cache, which would later overwrite real remote state on the
// next push. Returns null only after exhausting the retry budget.
async function authedHeadersAwait(
  attempts = 8,
  delayMs = 250,
): Promise<Record<string, string> | null> {
  for (let i = 0; i < attempts; i++) {
    const headers = await authedHeaders();
    if (headers) return headers;
    if (i === attempts - 1) return null;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

export async function fetchRemoteTrips(): Promise<Trip[] | null> {
  try {
    const headers = await authedHeadersAwait();
    if (!headers) return null;
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
    if (!headers) return false;
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

// Server-side purge of every trip we hold for the signed-in user. Used by
// the in-app account-deletion flow before the Clerk user record itself is
// deleted. Uses the awaited token getter so a token that is still being
// minted (race on slow networks) doesn't make the purge silently fail and
// orphan the user's data on the backend.
export async function purgeRemoteTrips(): Promise<boolean> {
  try {
    const headers = await authedHeadersAwait();
    if (!headers) return false;
    const res = await fetch(`${API_BASE}/trips`, {
      method: "DELETE",
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}
