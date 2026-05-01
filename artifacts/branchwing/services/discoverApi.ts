// Discover/public API helpers. Endpoints are unauthenticated but we attach
// the Bearer token when present so future personalized feeds have a hook.
import type { Trip } from "@/lib/types";
import { API_BASE } from "@/services/tripsSync";

export type PublicAuthor = { handle: string };
export type DiscoverItem = {
  trip: Trip;
  author: PublicAuthor;
  updatedAt: string;
};
export type DiscoverFeed = {
  items: DiscoverItem[];
  nextCursor: string | null;
};
export type PublicProfile = { handle: string; createdAt: string };
export type PublicProfilePage = {
  profile: PublicProfile;
  trips: DiscoverItem[];
};
export type MyProfile = { handle: string; createdAt: string };

type TokenGetter = () => Promise<string | null> | string | null;
let tokenGetter: TokenGetter | null = null;

export function setDiscoverAuthTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = tokenGetter ? await tokenGetter() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchMyProfile(): Promise<MyProfile | null> {
  try {
    const headers = await buildHeaders();
    if (!headers.Authorization) return null;
    const res = await fetch(`${API_BASE}/me/profile`, { headers });
    if (!res.ok) return null;
    return (await res.json()) as MyProfile;
  } catch {
    return null;
  }
}

export async function fetchDiscoverFeed(opts?: {
  cursor?: string | null;
  limit?: number;
}): Promise<DiscoverFeed | null> {
  try {
    const headers = await buildHeaders();
    const params = new URLSearchParams();
    if (opts?.cursor) params.set("cursor", opts.cursor);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const url = `${API_BASE}/discover/trips${params.toString() ? `?${params}` : ""}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return (await res.json()) as DiscoverFeed;
  } catch {
    return null;
  }
}

export type FetchPublicTripResult =
  | { kind: "ok"; item: DiscoverItem }
  | { kind: "notFound" }
  | { kind: "error" };

export async function fetchPublicTrip(
  id: string,
): Promise<FetchPublicTripResult> {
  try {
    const headers = await buildHeaders();
    const res = await fetch(
      `${API_BASE}/discover/trips/${encodeURIComponent(id)}`,
      { headers },
    );
    if (res.status === 404) return { kind: "notFound" };
    if (!res.ok) return { kind: "error" };
    return { kind: "ok", item: (await res.json()) as DiscoverItem };
  } catch {
    return { kind: "error" };
  }
}

export type FetchPublicProfileResult =
  | { kind: "ok"; page: PublicProfilePage }
  | { kind: "notFound" }
  | { kind: "error" };

export async function fetchPublicProfile(
  handle: string,
): Promise<FetchPublicProfileResult> {
  try {
    const headers = await buildHeaders();
    const res = await fetch(
      `${API_BASE}/users/${encodeURIComponent(handle)}`,
      { headers },
    );
    if (res.status === 404) return { kind: "notFound" };
    if (!res.ok) return { kind: "error" };
    return { kind: "ok", page: (await res.json()) as PublicProfilePage };
  } catch {
    return { kind: "error" };
  }
}
