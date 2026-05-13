# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Branchwing (artifacts/branchwing)

iOS-feel Expo flight planning app where users branch travel plans (fork
itineraries into alternate scenarios). Offline-first AsyncStorage cache
mirrored to a Replit-hosted Postgres backend so trips survive reinstalls.

Mirrors the file structure of github.com/IamJasonBian/route-manager:

- `services/api.ts` — UI-facing data layer. Currently sources from local
  synthetic catalog; ready to swap in a Netlify/Amadeus proxy via
  `EXPO_PUBLIC_API_BASE` without touching UI.
- `services/routeService.ts` — saved routes CRUD (AsyncStorage,
  `branchwing.savedRoutes.v1`).
- `services/flightService.ts` — facade over `lib/flightSearch`.
- `lib/defaultRoutes.ts` — seeded popular routes (JFK→LHR, etc.).
- `lib/priceHistory.ts` — deterministic 90-day synthetic price series.

Screens:

- `/` — home + "Browse popular routes" tile + trips list.
- `/routes` — popular routes dashboard with All/Saved filter & pull-to-refresh.
- `/route/[od]` — route detail with summary card, segmented control
  ("Flights today" / "Price trends"), sort chips, and detail grid.
- Existing trip / fork / search-flights / new-trip flows untouched.

Storage keys:

- `branchwing.trips.v2` — trips (local cache mirror)
- `branchwing.savedRoutes.v1` — pinned routes
- `branchwing.clientId.v1` — stable per-device id sent as `X-Client-Id`

Trip persistence:

- `services/tripsSync.ts` wraps `GET / PUT / DELETE /api/trips` with a Clerk
  `Authorization: Bearer <jwt>` header. `authedHeadersAwait` retries the
  token getter (8×250ms) so cold-start fetches don't silently 401 before
  Clerk's session has hydrated. The base URL is `EXPO_PUBLIC_API_BASE_URL`
  if set, else `https://$EXPO_PUBLIC_DOMAIN/api`, else `/api`.
- `contexts/TripsContext.tsx` hydrates from a per-userId AsyncStorage cache
  immediately, then reconciles with the server in the background. The
  auto-push effect is gated by a `reconciled` flag and `localMutationsRef`:
  no PUT fires until the first GET has returned (or definitively failed),
  unless the user has already started editing — that guarantees a slow
  cold-start GET can never lose to the debounced first PUT and overwrite
  real remote state with a stale local cache. Every change triggers a
  600ms-debounced PUT with a monotonic revision counter so out-of-order
  responses can't desync the badge.
- Server (`artifacts/api-server/src/routes/trips.ts`) is bulk-replace per
  Clerk userId: `requireAuth` middleware → `DELETE WHERE user_id = ?` then
  `INSERT` inside a transaction. Routes are GET / PUT / DELETE.
- DB schema (`lib/db/src/schema/trips.ts`): composite primary key
  `(user_id, id)` so trip IDs only need to be unique per user.
- Auth: `@clerk/expo` (email + password only — avoids Apple Guideline 4.8).
  Trips follow the Clerk userId across devices.

Account deletion (Apple Guideline 5.1.1(v)):

- `app/account.tsx` has Sign Out and Delete Account. Delete is transactional
  from the user's POV: `purgeRemoteTrips()` (server `DELETE /api/trips`,
  must succeed) → `dropUserCache(userId)` → `user.delete()` (wrapped in
  `useReverification` with a custom in-app "Confirm your password" modal
  that calls `session.startVerification({level:"first_factor"})` then
  `session.attemptFirstFactorVerification({strategy:"password",password})`)
  → `signOut()` so the AuthGate redirects to `/sign-in`.
- If the server purge fails, deletion aborts before the Clerk record is
  touched (no orphaned data). If `user.delete()` fails after the purge
  succeeds, the user sees a specific message asking them to try again.

Run typecheck: `pnpm --filter @workspace/branchwing run typecheck`

Discover (public trips, Task #2):

- Schema additions in a single hand-written additive migration
  `lib/db/drizzle/0000_init_public_discover.sql` with `IF NOT EXISTS`
  guards: `trips.is_public` bool default false (with backfill to false
  for pre-existing rows), composite index `trips_public_feed_idx
  (is_public, updated_at)`, and the `user_profiles` table keyed by
  `clerk_user_id` with case-insensitive uniqueness via
  `uniqueIndex("user_profiles_handle_lower_unique").on(sql\`lower(handle)\`)`.
  Verified idempotent on a simulated legacy DB; live row-count diff
  showed all pre-existing trips backfilled to `is_public=false`.
- Endpoints (`artifacts/api-server/src/routes/discover.ts`,
  `routes/profile.ts`): `GET /api/discover/trips` (public feed with
  cursor `<isoMs>|<id>` paginating on `date_trunc('milliseconds',
  updated_at)`; auth-aware — signed-in viewers see all public trips
  except their own), `GET /api/discover/trips/:id` (404 for
  missing-or-private to prevent existence probing), `GET
  /api/users/:handle` (case-insensitive, profile + their public
  trips), `GET /api/me/profile` (get-or-create using
  `lib/clerkEmail.ts::fetchPrimaryEmail` which requires a verified
  primary email and otherwise surfaces 503).
- Handle derivation (`lib/handle.ts`): lowercase email local-part,
  drop `+tag` and dots, keep `[a-z0-9_]`, clamp to 20 chars; if too
  short, fall back to `user_<first 8 hex of sha256(clerkUserId)>` so
  no raw fragment of the Clerk id is leaked.
- Collision resolution (`lib/userProfile.ts::ensureUserProfile`): try
  the bare handle, then numeric suffixes `base2..base99`, then 8
  progressively-longer sha256-derived suffixes seeded by
  `clerkUserId`. ACCEPTED drift from the literal "unbounded numeric"
  spec wording — the deterministic hash tail guarantees termination
  while still preferring readable numeric suffixes for the realistic
  collision range. Race-safe via `INSERT ... RETURNING` + 23505
  re-read.
- Client cache: `services/discoverApi.ts` persists `myProfile` under
  `branchwing.myProfile.v1` in AsyncStorage. The account screen seeds
  from `loadCachedMyProfile()` for instant offline render and the
  AuthGate bootstrap calls `fetchMyProfile()` once per signed-in
  identity (with one 5s retry on null). Sign-out and account-delete
  call `clearCachedMyProfile()`.
- UI: Three-tab bottom nav (`components/BottomTabBar.tsx`) — Trips (`/`),
  Discover (`/discover`), Account (`/account`); mounted on each tab root
  screen. Tab switches use `router.replace()` so the back-stack stays flat.
  Compass and user icons removed from the home header. `app/discover.tsx`
  list, `app/users/[handle].tsx` profile, `app/public-trips/[id].tsx`
  read-only trip viewer (no FAB, no New-Branch chip, no delete, no
  privacy toggle); `components/PublicTripCard.tsx` card with separate
  Pressables for the @handle pill and body, and an "updated <relative>"
  line via `lib/time.ts::fmtRelative`.
- Privacy regression: `pnpm --filter @workspace/scripts run
  test:discover-privacy` inserts a public + private trip and a profile,
  then asserts via the shared proxy that `/discover/trips/:id` is 404
  for private, the discover feed and `/users/:handle` exclude private
  trips, and case-insensitive handle lookup works. All 8 assertions
  pass against the live API.
