import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const USER_ID = "user_3DejfUCyQNYc0rizRsuIx6ssG7X";
const HANDLE = "jasonbian64";
const EMAIL = "jason.bian64@gmail.com";
const TRIP_ID = "jason-nyc-la-29-31";

const now = new Date();
const iso = (daysFromNow: number, hour = 9, minute = 0) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

const trip = {
  id: TRIP_ID,
  title: "NYC to LA Weekend",
  originCity: "New York",
  originCode: "JFK",
  startDate: iso(29),
  createdAt: iso(-1),
  isPublic: true,
  activeBranchId: "main",
  branches: [
    {
      id: "main",
      label: "Roundtrip",
      parentId: null,
      forkAfterSegmentId: null,
      color: "#0A84FF",
      createdAt: iso(-1),
      segments: [
        {
          id: "s1",
          fromCode: "JFK",
          fromCity: "New York",
          toCode: "LAX",
          toCity: "Los Angeles",
          depart: iso(29, 8, 0),
          arrive: iso(29, 11, 25),
          airline: "JetBlue",
          flightNo: "B6523",
          price: 287,
        },
        {
          id: "s2",
          fromCode: "LAX",
          fromCity: "Los Angeles",
          toCode: "JFK",
          toCity: "New York",
          depart: iso(31, 22, 15),
          arrive: iso(32, 6, 50),
          airline: "Delta",
          flightNo: "DL412",
          price: 312,
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
  console.log(`Seeded public NYC->LA trip as @${HANDLE} (trip id: ${TRIP_ID}).`);
  console.log(`  Depart:  ${trip.branches[0].segments[0].depart}  JFK -> LAX`);
  console.log(`  Return:  ${trip.branches[0].segments[1].depart}  LAX -> JFK`);
  console.log(`  Discover feed:  GET /api/discover/trips`);
  console.log(`  Trip detail:    GET /api/discover/trips/${TRIP_ID}`);
  console.log(`  Public profile: GET /api/users/${HANDLE}`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
