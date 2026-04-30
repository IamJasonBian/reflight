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

- `services/tripsSync.ts` wraps `GET /api/trips` and `PUT /api/trips`. The
  base URL is `EXPO_PUBLIC_API_BASE_URL` if set, else
  `https://$EXPO_PUBLIC_DOMAIN/api`, else `/api`.
- `contexts/TripsContext.tsx` hydrates from AsyncStorage immediately, then
  reconciles with the server in the background. If the user mutates trips
  while the remote fetch is in flight, the local edits win. Every change
  triggers a 600ms-debounced PUT with a monotonic revision counter so
  out-of-order responses can't desync the badge.
- Server (`artifacts/api-server/src/routes/trips.ts`) is bulk-replace per
  client: `DELETE WHERE client_id = ?` then `INSERT` inside a transaction.
- DB schema (`lib/db/src/schema/trips.ts`): composite primary key
  `(client_id, id)` so trip IDs only need to be unique per device.
- Per-device `X-Client-Id` is the only access control today (MVP). Reinstall
  on a fresh device gets a new id and starts empty — cross-device handoff
  needs an account/linking flow which is out of scope.

Run typecheck: `pnpm --filter @workspace/branchwing run typecheck`
