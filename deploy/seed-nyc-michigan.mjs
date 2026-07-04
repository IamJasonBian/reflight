#!/usr/bin/env node
// ============================================================================
// seed-nyc-michigan.mjs — emit SQL that seeds the NYC <-> Michigan demo trips
// (Detroit + Grand Rapids) into the live `trips` table, public, across the
// next four weeks. Pure Node (no deps); pipe the output into psql.
//
//   node seed-nyc-michigan.mjs | PGPASSWORD=... psql -h ... -U reflight reflight
//
// Modeling:
//   originCode "JFK" = single-airport trips ("JFK only").
//   originCode "NYC" = metro trips; NYC is the real IATA metro code, so the
//                      branches legitimately depart from JFK / LGA / EWR.
//   GRR has no dependable NYC-area nonstop -> connection markets (via DTW on
//   Delta, via ORD on American/United), which is what branches are good at.
// Flight numbers / times / prices are realistic but representative.
// ============================================================================

const USER_ID = "user_3DejfUCyQNYc0rizRsuIx6ssG7X"; // @jasonbian64 (existing profile)
const HANDLE = "jasonbian64";
const EMAIL = "jason.bian64@gmail.com";

const CITY = {
  JFK: "New York", LGA: "New York", EWR: "New York", NYC: "New York",
  DTW: "Detroit", GRR: "Grand Rapids", ORD: "Chicago",
};

// Anchor on a fixed "today" so re-runs are deterministic (script today = 2026-06-15).
const TODAY = new Date("2026-06-15T00:00:00.000Z");
const iso = (days, hour = 9, min = 0) => {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, min, 0, 0);
  return d.toISOString();
};
const addH = (isoStr, h) => new Date(new Date(isoStr).getTime() + h * 3600e3).toISOString();
const createdAt = iso(-1);

// Build a branch's segments from legs. First leg: {departDay, departHour};
// connecting legs: {layoverH}. Each leg: from,to,airline,flightNo,durationH,price.
function segments(idPrefix, departDay, legs) {
  const out = [];
  let cursor = null;
  legs.forEach((l, i) => {
    const depart = cursor == null
      ? iso(departDay, l.departHour ?? 8, l.departMin ?? 0)
      : addH(cursor, l.layoverH ?? 1.25);
    const arrive = addH(depart, l.durationH);
    out.push({
      id: `${idPrefix}-s${i + 1}`,
      fromCode: l.from, fromCity: CITY[l.from] ?? l.from,
      toCode: l.to, toCity: CITY[l.to] ?? l.to,
      depart, arrive, airline: l.airline, flightNo: l.flightNo, price: l.price,
    });
    cursor = arrive;
  });
  return out;
}

const PALETTE = ["#0A84FF", "#FF9F0A", "#30D158", "#BF5AF2", "#FF375F"];
const branch = (tripId, key, label, idx, departDay, legs, parentId) => ({
  id: `${tripId}-${key}`,
  label,
  parentId,
  forkAfterSegmentId: null,
  color: PALETTE[idx % PALETTE.length],
  createdAt,
  segments: segments(`${tripId}-${key}`, departDay, legs),
});

function trip(id, title, originCode, startDay, branches) {
  return {
    id, title,
    originCity: CITY[originCode] ?? originCode,
    originCode,
    startDate: iso(startDay),
    createdAt,
    isPublic: true,
    activeBranchId: branches[0].id,
    branches,
  };
}

const trips = [];

// ── Week 1 · JFK -> Detroit (single airport, time-of-day alternatives) ──
{
  const id = "mi-jfk-dtw";
  const main = branch(id, "morning", "Morning nonstop", 0, 5,
    [{ from: "JFK", to: "DTW", airline: "Delta", flightNo: "DL2095", departHour: 7, durationH: 2.0, price: 189 }], null);
  const eve = branch(id, "evening", "Evening nonstop", 1, 5,
    [{ from: "JFK", to: "DTW", airline: "Delta", flightNo: "DL1640", departHour: 18, durationH: 2.1, price: 156 }], main.id);
  trips.push(trip(id, "JFK → Detroit", "JFK", 5, [main, eve]));
}

// ── Week 2 · JFK -> Grand Rapids (no nonstop — routing alternatives) ──
{
  const id = "mi-jfk-grr";
  const viaDtw = branch(id, "via-dtw", "Via Detroit", 0, 12, [
    { from: "JFK", to: "DTW", airline: "Delta", flightNo: "DL2095", departHour: 7, durationH: 2.0, price: 189 },
    { from: "DTW", to: "GRR", airline: "Delta", flightNo: "DL4612", layoverH: 1.25, durationH: 0.75, price: 98 },
  ], null);
  const viaOrd = branch(id, "via-ord", "Via Chicago", 1, 12, [
    { from: "JFK", to: "ORD", airline: "American", flightNo: "AA1280", departHour: 8, durationH: 2.75, price: 164 },
    { from: "ORD", to: "GRR", airline: "American Eagle", flightNo: "AA4035", layoverH: 1.5, durationH: 0.92, price: 112 },
  ], viaDtw.id);
  trips.push(trip(id, "JFK → Grand Rapids", "JFK", 12, [viaDtw, viaOrd]));
}

// ── Week 3 · New York -> Detroit (which airport — all nonstop, incl. LGA) ──
{
  const id = "mi-nyc-dtw";
  const lga = branch(id, "lga", "From LaGuardia", 0, 19,
    [{ from: "LGA", to: "DTW", airline: "Delta", flightNo: "DL1234", departHour: 9, durationH: 2.0, price: 162 }], null);
  const jfk = branch(id, "jfk", "From JFK", 1, 19,
    [{ from: "JFK", to: "DTW", airline: "Delta", flightNo: "DL2095", departHour: 7, durationH: 2.0, price: 189 }], lga.id);
  const ewr = branch(id, "ewr", "From Newark", 2, 19,
    [{ from: "EWR", to: "DTW", airline: "United", flightNo: "UA1605", departHour: 10, durationH: 2.1, price: 174 }], lga.id);
  trips.push(trip(id, "New York → Detroit", "NYC", 19, [lga, jfk, ewr]));
}

// ── Week 4 · New York -> Grand Rapids (airport × routing, incl. LGA) ──
{
  const id = "mi-nyc-grr";
  const lga = branch(id, "lga-dtw", "LaGuardia via Detroit", 0, 26, [
    { from: "LGA", to: "DTW", airline: "Delta", flightNo: "DL1234", departHour: 9, durationH: 2.0, price: 162 },
    { from: "DTW", to: "GRR", airline: "Delta", flightNo: "DL4612", layoverH: 1.25, durationH: 0.75, price: 98 },
  ], null);
  const ewr = branch(id, "ewr-ord", "Newark via Chicago", 1, 26, [
    { from: "EWR", to: "ORD", airline: "United", flightNo: "UA521", departHour: 8, durationH: 2.67, price: 151 },
    { from: "ORD", to: "GRR", airline: "United Express", flightNo: "UA4319", layoverH: 1.5, durationH: 0.92, price: 109 },
  ], lga.id);
  const jfk = branch(id, "jfk-dtw", "JFK via Detroit", 2, 26, [
    { from: "JFK", to: "DTW", airline: "Delta", flightNo: "DL2095", departHour: 7, durationH: 2.0, price: 189 },
    { from: "DTW", to: "GRR", airline: "Delta", flightNo: "DL4612", layoverH: 1.25, durationH: 0.75, price: 98 },
  ], lga.id);
  trips.push(trip(id, "New York → Grand Rapids", "NYC", 26, [lga, ewr, jfk]));
}

// ── Emit SQL ────────────────────────────────────────────────────────────────
const lines = [];
lines.push("BEGIN;");
lines.push(
  `INSERT INTO user_profiles (clerk_user_id, handle, email)
 VALUES ('${USER_ID}', '${HANDLE}', '${EMAIL}')
 ON CONFLICT (clerk_user_id) DO UPDATE SET handle = EXCLUDED.handle, email = EXCLUDED.email;`,
);
for (const t of trips) {
  lines.push(`DELETE FROM trips WHERE user_id = '${USER_ID}' AND id = '${t.id}';`);
  lines.push(
    `INSERT INTO trips (id, user_id, payload, is_public, updated_at)
 VALUES ('${t.id}', '${USER_ID}', $json$${JSON.stringify(t)}$json$::jsonb, true, now());`,
  );
}
lines.push("COMMIT;");
lines.push(
  `SELECT id, is_public, payload->>'title' AS title, payload->>'originCode' AS origin,
        jsonb_array_length(payload->'branches') AS branches
 FROM trips WHERE user_id = '${USER_ID}' AND id LIKE 'mi-%' ORDER BY id;`,
);
process.stdout.write(lines.join("\n") + "\n");
