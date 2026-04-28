import {
  AIRLINE_PREFIXES,
  AIRLINES,
  findAirport,
  haversineMiles,
  type Airport,
} from "./airports";

export type FlightOption = {
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

export type SearchParams = {
  originCode: string;
  destCode: string;
  date: string;
};

const REGIONAL_CARRIERS: Record<string, string[]> = {
  USA: ["Delta", "United", "American", "JetBlue", "Alaska"],
  Canada: ["Air Canada", "Delta", "United"],
  UK: ["British Airways", "American", "Aer Lingus"],
  France: ["Air France", "Delta", "KLM"],
  Netherlands: ["KLM", "Delta", "Air France"],
  Germany: ["Lufthansa", "United"],
  Spain: ["Iberia", "Lufthansa", "British Airways"],
  Italy: ["Lufthansa", "Air France", "British Airways"],
  Iceland: ["Icelandair", "Delta"],
  Norway: ["Lufthansa", "KLM"],
  Sweden: ["Lufthansa", "KLM"],
  Denmark: ["KLM", "Lufthansa"],
  Switzerland: ["Lufthansa"],
  Austria: ["Lufthansa"],
  Ireland: ["Aer Lingus", "British Airways"],
  Greece: ["Lufthansa", "Turkish Airlines"],
  Portugal: ["Iberia", "Lufthansa"],
  Turkey: ["Turkish Airlines", "Lufthansa"],
  UAE: ["Emirates", "Qatar"],
  Singapore: ["Singapore Airlines", "Emirates"],
  Japan: ["ANA", "Singapore Airlines"],
  "South Korea": ["ANA", "Singapore Airlines"],
  China: ["Cathay Pacific", "Singapore Airlines"],
  Thailand: ["Cathay Pacific", "Emirates"],
  Australia: ["Qatar", "Singapore Airlines", "Emirates"],
  Mexico: ["American", "Delta", "United"],
  Brazil: ["American", "Delta"],
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function plausibleAirlines(from: Airport, to: Airport): string[] {
  const fromAir = REGIONAL_CARRIERS[from.country] ?? [];
  const toAir = REGIONAL_CARRIERS[to.country] ?? [];
  const merged = Array.from(new Set([...fromAir, ...toAir])).filter((a) =>
    AIRLINES.includes(a),
  );
  if (merged.length >= 3) return merged;
  // top up with reasonable globals
  for (const a of [
    "Delta",
    "United",
    "Lufthansa",
    "British Airways",
    "Emirates",
  ]) {
    if (!merged.includes(a) && AIRLINES.includes(a)) merged.push(a);
    if (merged.length >= 4) break;
  }
  return merged;
}

function flightNumber(airline: string, salt: number): string {
  const prefix = AIRLINE_PREFIXES[airline] ?? "FL";
  const num = 100 + (salt % 9899);
  return `${prefix}${num}`;
}

export function estimateFlightMinutes(miles: number): number {
  const cruiseMin = (miles / 525) * 60;
  return Math.round(cruiseMin + 30); // taxi + climb/descent buffer
}

export function searchFlights(params: SearchParams): FlightOption[] {
  const from = findAirport(params.originCode);
  const to = findAirport(params.destCode);
  if (!from || !to || from.code === to.code) return [];

  const miles = haversineMiles(from, to);
  const flightMin = estimateFlightMinutes(miles);
  const airlines = plausibleAirlines(from, to);

  const date = new Date(params.date);
  date.setHours(0, 0, 0, 0);

  const seed = hashStr(`${from.code}-${to.code}-${date.toISOString().slice(0, 10)}`);
  const rand = makeRng(seed);

  const baseFare = Math.max(75, Math.round(miles * 0.18));
  const departureSlots = [6, 8, 10, 13, 15, 17, 19, 21];
  const numFlights = 5 + Math.floor(rand() * 3);

  // Shuffle slots deterministically and take first N
  const shuffled = [...departureSlots].sort(() => rand() - 0.5);
  const chosenSlots = shuffled.slice(0, numFlights).sort((a, b) => a - b);

  const results: FlightOption[] = chosenSlots.map((hour, idx) => {
    const minute = [0, 10, 15, 25, 35, 45, 55][Math.floor(rand() * 7)];
    const depart = new Date(date);
    depart.setHours(hour, minute, 0, 0);

    const isDirect = miles < 5000 || rand() > 0.35;
    const stops = isDirect ? 0 : 1;
    const stopBuffer = stops > 0 ? 90 + Math.floor(rand() * 60) : 0;
    const totalMin = flightMin + stopBuffer;
    const arrive = new Date(depart.getTime() + totalMin * 60 * 1000);

    const airline = airlines[idx % airlines.length];
    const peakMul = hour >= 16 && hour <= 20 ? 1.2 : hour <= 7 ? 0.85 : 1.0;
    const variance = 0.85 + rand() * 0.45;
    const stopDiscount = stops > 0 ? 0.78 : 1.0;
    const price = Math.round(baseFare * peakMul * variance * stopDiscount);

    return {
      id: `${from.code}-${to.code}-${depart.toISOString()}-${idx}`,
      fromCode: from.code,
      fromCity: from.city,
      toCode: to.code,
      toCity: to.city,
      depart: depart.toISOString(),
      arrive: arrive.toISOString(),
      durationMin: totalMin,
      airline,
      flightNo: flightNumber(airline, seed + idx * 17),
      price,
      stops,
    };
  });

  return results;
}

export type SortMode = "depart" | "price" | "duration";

export function sortFlights(
  flights: FlightOption[],
  mode: SortMode,
): FlightOption[] {
  const arr = [...flights];
  if (mode === "depart") {
    arr.sort(
      (a, b) => new Date(a.depart).getTime() - new Date(b.depart).getTime(),
    );
  } else if (mode === "price") {
    arr.sort((a, b) => a.price - b.price);
  } else if (mode === "duration") {
    arr.sort((a, b) => a.durationMin - b.durationMin);
  }
  return arr;
}
