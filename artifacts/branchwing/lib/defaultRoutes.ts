import type { RouteMeta } from "./types";

export const DEFAULT_ROUTES: RouteMeta[] = [
  { fromCode: "JFK", toCode: "LHR", basePrice: 540, popularity: 0.95 },
  { fromCode: "JFK", toCode: "LAX", basePrice: 285, popularity: 0.98 },
  { fromCode: "SFO", toCode: "HND", basePrice: 720, popularity: 0.82 },
  { fromCode: "LAX", toCode: "SYD", basePrice: 980, popularity: 0.62 },
  { fromCode: "BOS", toCode: "DUB", basePrice: 460, popularity: 0.55 },
  { fromCode: "ORD", toCode: "CDG", basePrice: 580, popularity: 0.71 },
  { fromCode: "MIA", toCode: "MEX", basePrice: 240, popularity: 0.66 },
  { fromCode: "SEA", toCode: "ICN", basePrice: 690, popularity: 0.58 },
  { fromCode: "JFK", toCode: "KEF", basePrice: 380, popularity: 0.48 },
  { fromCode: "LHR", toCode: "DXB", basePrice: 410, popularity: 0.79 },
];
