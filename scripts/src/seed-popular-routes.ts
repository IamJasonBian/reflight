/**
 * Seed the branchwing "popular routes" with REAL flight data from Amadeus.
 *
 * For each popular route this fetches live flight offers from the Amadeus
 * Flight Offers Search API, maps them into the app's FlightOption shape, and
 * writes a committed data module
 * (`artifacts/branchwing/lib/seededRoutes.generated.ts`) that the app consumes
 * in place of the synthetic catalog. The synthetic generator stays as the
 * fallback for arbitrary (non-popular) routes.
 *
 * The route list below mirrors branchwing's `lib/defaultRoutes.ts`. It is kept
 * inline (rather than imported) so this script stays self-contained and within
 * the @workspace/scripts package boundary — matching the other seed scripts. If
 * DEFAULT_ROUTES changes, update ROUTES here and re-run.
 *
 * The seeded flights carry their real (future) departure dates and prices.
 * Because those dates eventually pass, the app flags stale flights/trips at
 * runtime via `lib/validity.ts` — there is no automatic refresh here; re-run
 * this script to refresh the snapshot.
 *
 * Usage (creds live on the Netlify `route-manager-prod` site):
 *   AMADEUS_API_KEY=… AMADEUS_API_SECRET=… [AMADEUS_HOSTNAME=production] \
 *   [SEED_DEPARTURE_DATE=YYYY-MM-DD] [SEED_DAYS_OUT=30] \
 *   pnpm --filter @workspace/scripts seed:popular-routes
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Mirrors artifacts/branchwing/lib/defaultRoutes.ts (+ city names from
// lib/airports.ts). popularity feeds the list ranking.
type RouteSeed = {
  fromCode: string;
  fromCity: string;
  toCode: string;
  toCity: string;
  popularity: number;
};
const ROUTES: RouteSeed[] = [
  { fromCode: "JFK", fromCity: "New York", toCode: "LHR", toCity: "London", popularity: 0.95 },
  { fromCode: "JFK", fromCity: "New York", toCode: "LAX", toCity: "Los Angeles", popularity: 0.98 },
  { fromCode: "SFO", fromCity: "San Francisco", toCode: "HND", toCity: "Tokyo", popularity: 0.82 },
  { fromCode: "LAX", fromCity: "Los Angeles", toCode: "SYD", toCity: "Sydney", popularity: 0.62 },
  { fromCode: "BOS", fromCity: "Boston", toCode: "DUB", toCity: "Dublin", popularity: 0.55 },
  { fromCode: "ORD", fromCity: "Chicago", toCode: "CDG", toCity: "Paris", popularity: 0.71 },
  { fromCode: "MIA", fromCity: "Miami", toCode: "MEX", toCity: "Mexico City", popularity: 0.66 },
  { fromCode: "SEA", fromCity: "Seattle", toCode: "ICN", toCity: "Seoul", popularity: 0.58 },
  { fromCode: "JFK", fromCity: "New York", toCode: "KEF", toCity: "Reykjavik", popularity: 0.48 },
  { fromCode: "LHR", fromCity: "London", toCode: "DXB", toCity: "Dubai", popularity: 0.79 },
];

// Local mirror of branchwing's FlightOption (lib/flightSearch.ts).
type FlightOption = {
  id: string;
  fromCode: string;
  fromCity: string;
  toCode: string;
  toCity: string;
  depart: string;
  arrive: string;
  durationMin: number;
  airline: string;
  flightNo: string;
  price: number;
  stops: number;
};

const API_KEY = process.env.AMADEUS_API_KEY;
const API_SECRET = process.env.AMADEUS_API_SECRET;
const HOSTNAME = process.env.AMADEUS_HOSTNAME || "production";

if (!API_KEY || !API_SECRET) {
  console.error(
    "AMADEUS_API_KEY and AMADEUS_API_SECRET are required.\n" +
      "Pull them from the Netlify route-manager-prod site, e.g.:\n" +
      '  netlify api getEnvVar --data \'{"accountId":"jasonzb",' +
      '"siteId":"d7e43b0c-8075-4c35-8439-536bf792adde","key":"AMADEUS_API_KEY"}\'',
  );
  process.exit(2);
}

const BASE_URL =
  HOSTNAME === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";

const MAX_OFFERS_PER_ROUTE = 6;

// Departure date to sample. Defaults to SEED_DAYS_OUT (30) days from now so the
// offers are comfortably inside the bookable window.
function defaultDepartureDate(): string {
  const daysOut = Number(process.env.SEED_DAYS_OUT || 30);
  const d = new Date();
  d.setDate(d.getDate() + daysOut);
  return d.toISOString().slice(0, 10);
}
const DEPARTURE_DATE = process.env.SEED_DEPARTURE_DATE || defaultDepartureDate();

type AmadeusSegment = {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
  number: string;
};
type AmadeusOffer = {
  price: { grandTotal: string; total: string };
  itineraries: { duration: string; segments: AmadeusSegment[] }[];
};
type AmadeusResponse = {
  data?: AmadeusOffer[];
  dictionaries?: { carriers?: Record<string, string> };
  errors?: unknown;
};

type SeededRouteOut = {
  fromCode: string;
  toCode: string;
  basePrice: number;
  popularity: number;
  flights: FlightOption[];
};

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: API_KEY!,
      client_secret: API_SECRET!,
    }),
  });
  const json = (await res.json()) as { access_token?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Amadeus auth failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

// "PT6H55M" -> 415
function parseIsoDurationMin(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  return (m[1] ? parseInt(m[1], 10) : 0) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}

// "VIRGIN ATLANTIC" -> "Virgin Atlantic"
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function mapOffers(
  route: RouteSeed,
  offers: AmadeusOffer[],
  carriers: Record<string, string>,
): FlightOption[] {
  return offers.slice(0, MAX_OFFERS_PER_ROUTE).map((offer, idx) => {
    const it = offer.itineraries[0];
    const segs = it.segments;
    const first = segs[0];
    const last = segs[segs.length - 1];
    const carrierCode = first.carrierCode;
    const airline = carriers[carrierCode]
      ? titleCase(carriers[carrierCode])
      : carrierCode;
    return {
      id: `${route.fromCode}-${route.toCode}-${first.departure.at}-${idx}`,
      fromCode: route.fromCode,
      fromCity: route.fromCity,
      toCode: route.toCode,
      toCity: route.toCity,
      // Amadeus returns timezone-naive local airport times; keep them as-is so
      // the clock time shown matches the airport's local time.
      depart: first.departure.at,
      arrive: last.arrival.at,
      durationMin: parseIsoDurationMin(it.duration),
      airline,
      flightNo: `${carrierCode}${first.number}`,
      price: Math.round(parseFloat(offer.price.grandTotal)),
      stops: segs.length - 1,
    };
  });
}

async function fetchRoute(
  token: string,
  route: RouteSeed,
): Promise<{ flights: FlightOption[]; basePrice: number | null }> {
  const url =
    `${BASE_URL}/v2/shopping/flight-offers?originLocationCode=${route.fromCode}` +
    `&destinationLocationCode=${route.toCode}&departureDate=${DEPARTURE_DATE}` +
    `&adults=1&max=${MAX_OFFERS_PER_ROUTE}&currencyCode=USD`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as AmadeusResponse;
  if (!res.ok || !json.data) {
    throw new Error(
      `Offers failed for ${route.fromCode}->${route.toCode} (${res.status}): ${JSON.stringify(json.errors ?? json).slice(0, 300)}`,
    );
  }
  const carriers = json.dictionaries?.carriers ?? {};
  const flights = mapOffers(route, json.data, carriers);
  const basePrice = flights.length
    ? Math.min(...flights.map((f) => f.price))
    : null;
  return { flights, basePrice };
}

function renderFile(routes: SeededRouteOut[], generatedAt: string): string {
  const body = routes
    .map((r) => {
      const flights = r.flights
        .map(
          (f) =>
            `      {\n` +
            `        id: ${JSON.stringify(f.id)},\n` +
            `        fromCode: ${JSON.stringify(f.fromCode)},\n` +
            `        fromCity: ${JSON.stringify(f.fromCity)},\n` +
            `        toCode: ${JSON.stringify(f.toCode)},\n` +
            `        toCity: ${JSON.stringify(f.toCity)},\n` +
            `        depart: ${JSON.stringify(f.depart)},\n` +
            `        arrive: ${JSON.stringify(f.arrive)},\n` +
            `        durationMin: ${f.durationMin},\n` +
            `        airline: ${JSON.stringify(f.airline)},\n` +
            `        flightNo: ${JSON.stringify(f.flightNo)},\n` +
            `        price: ${f.price},\n` +
            `        stops: ${f.stops},\n` +
            `      },`,
        )
        .join("\n");
      return (
        `  {\n` +
        `    fromCode: ${JSON.stringify(r.fromCode)},\n` +
        `    toCode: ${JSON.stringify(r.toCode)},\n` +
        `    basePrice: ${r.basePrice},\n` +
        `    popularity: ${r.popularity},\n` +
        `    flights: [\n${flights}\n    ],\n` +
        `  },`
      );
    })
    .join("\n");

  return (
    `// AUTO-GENERATED by scripts/src/seed-popular-routes.ts — DO NOT EDIT BY HAND.\n` +
    `// Real Amadeus flight offers sampled for departure ${DEPARTURE_DATE}.\n` +
    `// Re-run: pnpm --filter @workspace/scripts seed:popular-routes\n` +
    `import type { SeededRoute } from "./seededRoutes";\n\n` +
    `export const SEEDED_GENERATED_AT = ${JSON.stringify(generatedAt)};\n` +
    `export const SEEDED_DEPARTURE_DATE = ${JSON.stringify(DEPARTURE_DATE)};\n\n` +
    `export const SEEDED_ROUTES: SeededRoute[] = [\n${body}\n];\n`
  );
}

async function main() {
  console.log(
    `Seeding ${ROUTES.length} popular routes from Amadeus (${HOSTNAME}), departure ${DEPARTURE_DATE}…`,
  );
  const token = await getToken();
  const out: SeededRouteOut[] = [];

  for (const route of ROUTES) {
    try {
      const { flights, basePrice } = await fetchRoute(token, route);
      if (flights.length === 0 || basePrice == null) {
        console.warn(
          `  ${route.fromCode}→${route.toCode}: no offers, skipping (synthetic fallback will apply)`,
        );
        continue;
      }
      out.push({
        fromCode: route.fromCode,
        toCode: route.toCode,
        basePrice,
        popularity: route.popularity,
        flights,
      });
      console.log(
        `  ${route.fromCode}→${route.toCode}: ${flights.length} offers, from $${basePrice}`,
      );
    } catch (err) {
      console.warn(`  ${route.fromCode}→${route.toCode}: ${(err as Error).message}`);
    }
    // Be gentle with the rate limit.
    await new Promise((r) => setTimeout(r, 250));
  }

  if (out.length === 0) {
    console.error("No routes seeded — leaving existing data untouched.");
    process.exit(1);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const target = resolve(
    here,
    "../../artifacts/branchwing/lib/seededRoutes.generated.ts",
  );
  // Stamp the generation time. (Date.now is fine here — this is a one-shot CLI,
  // not a workflow that needs to be resumable/deterministic.)
  const generatedAt = new Date().toISOString();
  writeFileSync(target, renderFile(out, generatedAt));
  console.log(`\nWrote ${out.length}/${ROUTES.length} routes → ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
