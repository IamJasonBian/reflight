import { Pool } from "pg";

const API_BASE = process.env.API_BASE ?? "http://localhost:80/api";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const TEST_USER = "test-privacy-user-" + Date.now();
const PUBLIC_TRIP_ID = "pub-" + Date.now();
const PRIVATE_TRIP_ID = "priv-" + Date.now();
const HANDLE = "privtest" + Date.now().toString().slice(-6);

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  PASS ${msg}`);
  } else {
    console.error(`  FAIL ${msg}`);
    failures++;
  }
}

async function setup() {
  await pool.query(
    `INSERT INTO user_profiles (clerk_user_id, handle, email)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [TEST_USER, HANDLE, `${HANDLE}@test.local`],
  );
  await pool.query(
    `INSERT INTO trips (id, user_id, payload, is_public, updated_at)
     VALUES ($1, $2, $3, true, now()),
            ($4, $2, $5, false, now())`,
    [
      PUBLIC_TRIP_ID,
      TEST_USER,
      JSON.stringify({
        id: PUBLIC_TRIP_ID,
        title: "Public Test Trip",
        originCity: "X",
        originCode: "XXX",
        startDate: new Date().toISOString(),
        branches: [
          {
            id: "b1",
            label: "Main",
            parentId: null,
            forkAfterSegmentId: null,
            color: "#FF6B35",
            segments: [],
            createdAt: new Date().toISOString(),
          },
        ],
        activeBranchId: "b1",
        createdAt: new Date().toISOString(),
        isPublic: true,
      }),
      PRIVATE_TRIP_ID,
      JSON.stringify({
        id: PRIVATE_TRIP_ID,
        title: "Private Test Trip",
        originCity: "X",
        originCode: "XXX",
        startDate: new Date().toISOString(),
        branches: [
          {
            id: "b2",
            label: "Main",
            parentId: null,
            forkAfterSegmentId: null,
            color: "#FF6B35",
            segments: [],
            createdAt: new Date().toISOString(),
          },
        ],
        activeBranchId: "b2",
        createdAt: new Date().toISOString(),
        isPublic: false,
      }),
    ],
  );
}

async function cleanup() {
  await pool.query(`DELETE FROM trips WHERE user_id = $1`, [TEST_USER]);
  await pool.query(`DELETE FROM user_profiles WHERE clerk_user_id = $1`, [
    TEST_USER,
  ]);
  await pool.end();
}

async function run() {
  await setup();
  try {
    console.log("\n[1] GET /discover/trips/:id with private id → 404");
    const privateRes = await fetch(`${API_BASE}/discover/trips/${PRIVATE_TRIP_ID}`);
    assert(privateRes.status === 404, `private trip returns 404 (got ${privateRes.status})`);

    console.log("\n[2] GET /discover/trips/:id with public id → 200");
    const publicRes = await fetch(`${API_BASE}/discover/trips/${PUBLIC_TRIP_ID}`);
    assert(publicRes.status === 200, `public trip returns 200 (got ${publicRes.status})`);
    const publicBody = (await publicRes.json()) as { trip?: { id?: string } };
    assert(publicBody.trip?.id === PUBLIC_TRIP_ID, "public trip body matches");

    console.log("\n[3] GET /discover/trips feed must NOT include the private trip");
    const feedRes = await fetch(`${API_BASE}/discover/trips?limit=50`);
    const feed = (await feedRes.json()) as { items: { trip: { id: string } }[] };
    const ids = new Set(feed.items.map((i) => i.trip.id));
    assert(!ids.has(PRIVATE_TRIP_ID), "feed excludes private trip id");

    console.log(`\n[4] GET /users/${HANDLE} must NOT include the private trip`);
    const profRes = await fetch(`${API_BASE}/users/${HANDLE}`);
    assert(profRes.status === 200, `profile returns 200 (got ${profRes.status})`);
    const prof = (await profRes.json()) as { trips: { trip: { id: string } }[] };
    const profIds = new Set(prof.trips.map((t) => t.trip.id));
    assert(!profIds.has(PRIVATE_TRIP_ID), "profile excludes private trip id");
    assert(profIds.has(PUBLIC_TRIP_ID), "profile includes public trip id");

    console.log(`\n[5] GET /users/${HANDLE.toUpperCase()} (case-insensitive) → 200`);
    const upperRes = await fetch(`${API_BASE}/users/${HANDLE.toUpperCase()}`);
    assert(upperRes.status === 200, `uppercase handle returns 200 (got ${upperRes.status})`);
  } finally {
    await cleanup();
  }

  console.log("");
  if (failures > 0) {
    console.error(`FAIL: ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("OK: all privacy assertions passed");
}

run().catch((err) => {
  console.error("Test crashed:", err);
  cleanup().catch(() => {});
  process.exit(2);
});
