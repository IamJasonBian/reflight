import { findAirport, haversineMiles } from "./airports";
import type { PricePoint, RoutePriceHistory } from "./types";

const DAYS = 90;

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
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export function buildPriceHistory(
  fromCode: string,
  toCode: string,
  basePrice?: number,
): RoutePriceHistory {
  const from = findAirport(fromCode);
  const to = findAirport(toCode);
  const seed = hashStr(`${fromCode}-${toCode}-history-v1`);
  const rng = makeRng(seed);

  const dist = from && to ? haversineMiles(from, to) : 1500;
  const computedBase = basePrice ?? Math.max(120, Math.round(dist * 0.18));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const points: PricePoint[] = [];

  for (let i = DAYS - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const t = (DAYS - 1 - i) / DAYS;
    const wave1 = Math.sin(t * Math.PI * 4 + (seed % 11)) * 0.18;
    const wave2 = Math.sin(t * Math.PI * 1.5 + ((seed >> 4) % 7)) * 0.1;
    const dayOfWeek = date.getDay();
    const weekendMul =
      dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6 ? 0.05 : 0;
    const noise = (rng() - 0.5) * 0.12;
    const factor = 1 + wave1 + wave2 + weekendMul + noise;
    const price = Math.max(60, Math.round(computedBase * factor));
    points.push({ date: date.toISOString().slice(0, 10), price });
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
  const current = prices[prices.length - 1];
  const previous = prices[prices.length - 8] ?? current;
  const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const trend: RoutePriceHistory["trend"] =
    changePct > 3 ? "up" : changePct < -3 ? "down" : "flat";

  return {
    fromCode,
    toCode,
    points,
    min,
    max,
    avg,
    current,
    previous,
    trend,
    changePct,
  };
}
