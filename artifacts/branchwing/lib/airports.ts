export type Airport = {
  code: string;
  city: string;
  country: string;
};

export const AIRPORTS: Airport[] = [
  { code: "JFK", city: "New York", country: "USA" },
  { code: "LAX", city: "Los Angeles", country: "USA" },
  { code: "SFO", city: "San Francisco", country: "USA" },
  { code: "ORD", city: "Chicago", country: "USA" },
  { code: "MIA", city: "Miami", country: "USA" },
  { code: "SEA", city: "Seattle", country: "USA" },
  { code: "BOS", city: "Boston", country: "USA" },
  { code: "DEN", city: "Denver", country: "USA" },
  { code: "LHR", city: "London", country: "UK" },
  { code: "CDG", city: "Paris", country: "France" },
  { code: "AMS", city: "Amsterdam", country: "Netherlands" },
  { code: "FRA", city: "Frankfurt", country: "Germany" },
  { code: "MAD", city: "Madrid", country: "Spain" },
  { code: "BCN", city: "Barcelona", country: "Spain" },
  { code: "FCO", city: "Rome", country: "Italy" },
  { code: "IST", city: "Istanbul", country: "Turkey" },
  { code: "DXB", city: "Dubai", country: "UAE" },
  { code: "SIN", city: "Singapore", country: "Singapore" },
  { code: "HND", city: "Tokyo", country: "Japan" },
  { code: "ICN", city: "Seoul", country: "South Korea" },
  { code: "HKG", city: "Hong Kong", country: "China" },
  { code: "BKK", city: "Bangkok", country: "Thailand" },
  { code: "SYD", city: "Sydney", country: "Australia" },
  { code: "MEX", city: "Mexico City", country: "Mexico" },
  { code: "GRU", city: "São Paulo", country: "Brazil" },
  { code: "KEF", city: "Reykjavik", country: "Iceland" },
  { code: "OSL", city: "Oslo", country: "Norway" },
  { code: "ARN", city: "Stockholm", country: "Sweden" },
  { code: "CPH", city: "Copenhagen", country: "Denmark" },
  { code: "ZRH", city: "Zurich", country: "Switzerland" },
  { code: "VIE", city: "Vienna", country: "Austria" },
  { code: "ATH", city: "Athens", country: "Greece" },
  { code: "LIS", city: "Lisbon", country: "Portugal" },
  { code: "DUB", city: "Dublin", country: "Ireland" },
  { code: "YYZ", city: "Toronto", country: "Canada" },
  { code: "YVR", city: "Vancouver", country: "Canada" },
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

export function findAirport(code: string): Airport | null {
  return AIRPORTS.find((a) => a.code === code) ?? null;
}
