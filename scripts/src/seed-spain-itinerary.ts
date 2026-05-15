import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const USER_ID = "mock-spain-traveler";
const HANDLE = "spainmock";
const EMAIL = "spainmock@test.local";
const TRIP_ID = "mock-spain-itinerary";

const now = new Date();
const iso = (daysFromNow: number, hour = 9, minute = 0) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

const trip = {
  id: TRIP_ID,
  title: "Two Weeks in Spain",
  originCity: "New York",
  originCode: "JFK",
  startDate: iso(30),
  createdAt: iso(-2),
  isPublic: true,
  activeBranchId: "main",
  branches: [
    {
      id: "main",
      label: "Classic loop",
      parentId: null,
      forkAfterSegmentId: null,
      color: "#FF6B35",
      createdAt: iso(-2),
      segments: [
        {
          id: "s1",
          fromCode: "JFK",
          fromCity: "New York",
          toCode: "BCN",
          toCity: "Barcelona",
          depart: iso(30, 21, 30),
          arrive: iso(31, 11, 0),
          airline: "Iberia",
          flightNo: "IB6252",
          price: 612,
        },
        {
          id: "s2",
          fromCode: "BCN",
          fromCity: "Barcelona",
          toCode: "MAD",
          toCity: "Madrid",
          depart: iso(34, 10, 15),
          arrive: iso(34, 11, 35),
          airline: "Vueling",
          flightNo: "VY1004",
          price: 78,
        },
        {
          id: "s3",
          fromCode: "MAD",
          fromCity: "Madrid",
          toCode: "SVQ",
          toCity: "Sevilla",
          depart: iso(38, 16, 40),
          arrive: iso(38, 17, 50),
          airline: "Iberia",
          flightNo: "IB8410",
          price: 64,
        },
        {
          id: "s4",
          fromCode: "SVQ",
          fromCity: "Sevilla",
          toCode: "JFK",
          toCity: "New York",
          depart: iso(43, 12, 5),
          arrive: iso(43, 18, 20),
          airline: "Iberia",
          flightNo: "IB6253",
          price: 598,
        },
      ],
    },
    {
      id: "balearics",
      label: "Detour: Mallorca",
      parentId: "main",
      forkAfterSegmentId: "s2",
      color: "#3DA5D9",
      createdAt: iso(-1),
      segments: [
        {
          id: "b1",
          fromCode: "MAD",
          fromCity: "Madrid",
          toCode: "PMI",
          toCity: "Palma de Mallorca",
          depart: iso(36, 8, 30),
          arrive: iso(36, 9, 50),
          airline: "Air Europa",
          flightNo: "UX1011",
          price: 92,
        },
        {
          id: "b2",
          fromCode: "PMI",
          fromCity: "Palma de Mallorca",
          toCode: "SVQ",
          toCity: "Sevilla",
          depart: iso(38, 9, 15),
          arrive: iso(38, 10, 55),
          airline: "Vueling",
          flightNo: "VY3902",
          price: 88,
        },
      ],
    },
  ],
};

async function seed() {
  await pool.query(
    `INSERT INTO user_profiles (clerk_user_id, handle, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (clerk_user_id) DO UPDATE
       SET handle = EXCLUDED.handle, email = EXCLUDED.email`,
    [USER_ID, HANDLE, EMAIL],
  );
  await pool.query(`DELETE FROM trips WHERE user_id = $1 AND id = $2`, [
    USER_ID,
    TRIP_ID,
  ]);
  await pool.query(
    `INSERT INTO trips (id, user_id, payload, is_public, updated_at)
     VALUES ($1, $2, $3, true, now())`,
    [TRIP_ID, USER_ID, JSON.stringify(trip)],
  );
  console.log(`Seeded public Spain itinerary as @${HANDLE} (trip id: ${TRIP_ID}).`);
  console.log(`  Discover feed:   GET /api/discover/trips`);
  console.log(`  Trip detail:     GET /api/discover/trips/${TRIP_ID}`);
  console.log(`  Public profile:  GET /api/users/${HANDLE}`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
