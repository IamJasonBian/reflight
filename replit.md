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
