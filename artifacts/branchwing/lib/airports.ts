export type Airport = {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
};

export const AIRPORTS: Airport[] = [
  { code: "JFK", city: "New York", country: "USA", lat: 40.6413, lon: -73.7781 },
  { code: "LAX", city: "Los Angeles", country: "USA", lat: 33.9416, lon: -118.4085 },
  { code: "SFO", city: "San Francisco", country: "USA", lat: 37.6213, lon: -122.379 },
  { code: "ORD", city: "Chicago", country: "USA", lat: 41.9742, lon: -87.9073 },
  { code: "MIA", city: "Miami", country: "USA", lat: 25.7959, lon: -80.287 },
  { code: "SEA", city: "Seattle", country: "USA", lat: 47.4502, lon: -122.3088 },
  { code: "BOS", city: "Boston", country: "USA", lat: 42.3656, lon: -71.0096 },
  { code: "DEN", city: "Denver", country: "USA", lat: 39.8561, lon: -104.6737 },
  { code: "LHR", city: "London", country: "UK", lat: 51.47, lon: -0.4543 },
  { code: "CDG", city: "Paris", country: "France", lat: 49.0097, lon: 2.5479 },
  { code: "AMS", city: "Amsterdam", country: "Netherlands", lat: 52.3105, lon: 4.7683 },
  { code: "FRA", city: "Frankfurt", country: "Germany", lat: 50.0379, lon: 8.5622 },
  { code: "MAD", city: "Madrid", country: "Spain", lat: 40.4983, lon: -3.5676 },
  { code: "BCN", city: "Barcelona", country: "Spain", lat: 41.2974, lon: 2.0833 },
  { code: "FCO", city: "Rome", country: "Italy", lat: 41.8003, lon: 12.2389 },
  { code: "IST", city: "Istanbul", country: "Turkey", lat: 41.2753, lon: 28.7519 },
  { code: "DXB", city: "Dubai", country: "UAE", lat: 25.2532, lon: 55.3657 },
  { code: "SIN", city: "Singapore", country: "Singapore", lat: 1.3644, lon: 103.9915 },
  { code: "HND", city: "Tokyo", country: "Japan", lat: 35.5494, lon: 139.7798 },
  { code: "ICN", city: "Seoul", country: "South Korea", lat: 37.4602, lon: 126.4407 },
  { code: "HKG", city: "Hong Kong", country: "China", lat: 22.308, lon: 113.9185 },
  { code: "BKK", city: "Bangkok", country: "Thailand", lat: 13.69, lon: 100.7501 },
  { code: "SYD", city: "Sydney", country: "Australia", lat: -33.9399, lon: 151.1753 },
  { code: "MEX", city: "Mexico City", country: "Mexico", lat: 19.4361, lon: -99.0719 },
  { code: "GRU", city: "São Paulo", country: "Brazil", lat: -23.4356, lon: -46.4731 },
  { code: "KEF", city: "Reykjavik", country: "Iceland", lat: 63.985, lon: -22.6056 },
  { code: "OSL", city: "Oslo", country: "Norway", lat: 60.1939, lon: 11.1004 },
  { code: "ARN", city: "Stockholm", country: "Sweden", lat: 59.6519, lon: 17.9186 },
  { code: "CPH", city: "Copenhagen", country: "Denmark", lat: 55.6181, lon: 12.6561 },
  { code: "ZRH", city: "Zurich", country: "Switzerland", lat: 47.4647, lon: 8.5492 },
  { code: "VIE", city: "Vienna", country: "Austria", lat: 48.1103, lon: 16.5697 },
  { code: "ATH", city: "Athens", country: "Greece", lat: 37.9364, lon: 23.9445 },
  { code: "LIS", city: "Lisbon", country: "Portugal", lat: 38.7813, lon: -9.1359 },
  { code: "DUB", city: "Dublin", country: "Ireland", lat: 53.4264, lon: -6.2499 },
  { code: "YYZ", city: "Toronto", country: "Canada", lat: 43.6777, lon: -79.6248 },
  { code: "YVR", city: "Vancouver", country: "Canada", lat: 49.1939, lon: -123.1844 },
];

export const AIRLINES = [
  "Delta",
  "United",
  "American",
  "JetBlue",
  "Alaska",
  "Lufthansa",
  "Air France",
  "KLM",
  "British Airways",
  "Iberia",
  "Emirates",
  "Qatar",
  "Singapore Airlines",
  "ANA",
  "Cathay Pacific",
  "Icelandair",
  "Turkish Airlines",
  "Aer Lingus",
];

export const AIRLINE_PREFIXES: Record<string, string> = {
  Delta: "DL",
  United: "UA",
  American: "AA",
  JetBlue: "B6",
  Alaska: "AS",
  Lufthansa: "LH",
  "Air France": "AF",
  KLM: "KL",
  "British Airways": "BA",
  Iberia: "IB",
  Emirates: "EK",
  Qatar: "QR",
  "Singapore Airlines": "SQ",
  ANA: "NH",
  "Cathay Pacific": "CX",
  Icelandair: "FI",
  "Turkish Airlines": "TK",
  "Aer Lingus": "EI",
};

export function findAirport(code: string): Airport | null {
  return AIRPORTS.find((a) => a.code === code) ?? null;
}

export function haversineMiles(a: Airport, b: Airport): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
