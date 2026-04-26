import { branchPalette } from "@/constants/colors";

import type { Trip } from "./types";
import { addDays, addHours, genId } from "./time";

function isoAt(baseDate: Date, hour: number, minute = 0): string {
  const d = new Date(baseDate);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function buildSeedTrips(): Trip[] {
  const base = new Date();
  base.setDate(base.getDate() + 14);
  base.setHours(0, 0, 0, 0);

  const direct = isoAt(base, 21, 30);
  const directArr = addHours(direct, 7);

  const main = {
    id: genId(),
    label: "Main plan",
    parentId: null,
    forkAfterSegmentId: null,
    color: branchPalette[0],
    createdAt: new Date().toISOString(),
    segments: [
      {
        id: genId(),
        fromCode: "JFK",
        fromCity: "New York",
        toCode: "CDG",
        toCity: "Paris",
        depart: direct,
        arrive: directArr,
        airline: "Air France",
        flightNo: "AF23",
      },
    ],
  };

  const stopover = {
    id: genId(),
    label: "Via Reykjavik",
    parentId: main.id,
    forkAfterSegmentId: null,
    color: branchPalette[1],
    createdAt: new Date().toISOString(),
    segments: [
      {
        id: genId(),
        fromCode: "JFK",
        fromCity: "New York",
        toCode: "KEF",
        toCity: "Reykjavik",
        depart: isoAt(base, 19, 0),
        arrive: addHours(isoAt(base, 19, 0), 5.5),
        airline: "Icelandair",
        flightNo: "FI614",
      },
      {
        id: genId(),
        fromCode: "KEF",
        fromCity: "Reykjavik",
        toCode: "CDG",
        toCity: "Paris",
        depart: addHours(isoAt(base, 19, 0), 9),
        arrive: addHours(isoAt(base, 19, 0), 12),
        airline: "Icelandair",
        flightNo: "FI544",
      },
    ],
  };

  const dayLater = {
    id: genId(),
    label: "Leave a day later",
    parentId: main.id,
    forkAfterSegmentId: null,
    color: branchPalette[2],
    createdAt: new Date().toISOString(),
    segments: [
      {
        id: genId(),
        fromCode: "JFK",
        fromCity: "New York",
        toCode: "CDG",
        toCity: "Paris",
        depart: addDays(direct, 1),
        arrive: addDays(directArr, 1),
        airline: "Delta",
        flightNo: "DL264",
      },
    ],
  };

  const trip: Trip = {
    id: genId(),
    title: "Paris in spring",
    originCity: "New York",
    originCode: "JFK",
    startDate: base.toISOString(),
    branches: [main, stopover, dayLater],
    activeBranchId: main.id,
    createdAt: new Date().toISOString(),
  };

  return [trip];
}
