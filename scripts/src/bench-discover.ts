import { Pool } from "pg";

const API_BASE = process.env.API_BASE ?? "http://localhost:80/api";
const DATABASE_URL = process.env.DATABASE_URL;
const TOTAL = Number(process.env.BENCH_TOTAL ?? 100_000);
const USERS = Number(process.env.BENCH_USERS ?? 1_000);
const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 30);
const KEEP = process.env.BENCH_KEEP === "1";
const TAG = "bench-" + Date.now();

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function seed() {
  console.log(
    `Seeding ${TOTAL.toLocaleString()} public trips across ${USERS.toLocaleString()} users (tag=${TAG})...`,
  );
  const t0 = Date.now();

  const userIds: string[] = [];
  for (let i = 0; i < USERS; i++) {
    userIds.push(`${TAG}-u${i}`);
  }

  // Insert profiles in batches.
  const profileBatch = 1000;
  for (let i = 0; i < userIds.length; i += profileBatch) {
    const slice = userIds.slice(i, i + profileBatch);
    const values: string[] = [];
    const params: string[] = [];
    slice.forEach((uid, j) => {
      const base = j * 3;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
      params.push(uid, `${TAG.replace(/-/g, "")}h${i + j}`, `${uid}@bench.local`);
    });
    await pool.query(
      `INSERT INTO user_profiles (clerk_user_id, handle, email) VALUES ${values.join(
        ",",
      )} ON CONFLICT DO NOTHING`,
      params,
    );
  }

  // Insert trips in batches; spread updated_at across ~7 days so the
  // index is exercised over a realistic timestamp range.
  const tripBatch = 1000;
  const startMs = Date.now() - 7 * 24 * 3600 * 1000;
  const spanMs = 7 * 24 * 3600 * 1000;
  const nowIso = new Date().toISOString();
  const buildPayload = (tripId: string) =>
    JSON.stringify({
      id: tripId,
      title: "Bench Trip",
      originCity: "X",
      originCode: "XXX",
      startDate: nowIso,
      branches: [
        {
          id: "b1",
          label: "Main",
          parentId: null,
          forkAfterSegmentId: null,
          color: "#FF6B35",
          segments: [],
          createdAt: nowIso,
        },
      ],
      activeBranchId: "b1",
      createdAt: nowIso,
      isPublic: true,
    });

  for (let i = 0; i < TOTAL; i += tripBatch) {
    const n = Math.min(tripBatch, TOTAL - i);
    const values: string[] = [];
    const params: unknown[] = [];
    for (let k = 0; k < n; k++) {
      const idx = i + k;
      const userId = userIds[idx % USERS];
      const tripId = `${TAG}-t${idx}`;
      const updatedAt = new Date(startMs + Math.random() * spanMs);
      const base = k * 4;
      values.push(
        `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, true, $${base + 4})`,
      );
      params.push(tripId, userId, buildPayload(tripId), updatedAt);
    }
    await pool.query(
      `INSERT INTO trips (id, user_id, payload, is_public, updated_at) VALUES ${values.join(
        ",",
      )} ON CONFLICT DO NOTHING`,
      params,
    );
    if ((i / tripBatch) % 10 === 0) {
      process.stdout.write(
        `  inserted ${(i + n).toLocaleString()}/${TOTAL.toLocaleString()}\r`,
      );
    }
  }
  console.log(`\nSeed done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

  console.log("ANALYZE trips...");
  await pool.query("ANALYZE trips");
}

async function cleanup() {
  if (KEEP) {
    console.log(`BENCH_KEEP=1 set; leaving ${TAG} rows in place.`);
    return;
  }
  console.log("Cleaning up bench rows...");
  await pool.query(`DELETE FROM trips WHERE user_id LIKE $1`, [`${TAG}-%`]);
  await pool.query(`DELETE FROM user_profiles WHERE clerk_user_id LIKE $1`, [
    `${TAG}-%`,
  ]);
}

async function bench() {
  // Warm up.
  await fetch(`${API_BASE}/discover/trips?limit=20`);

  // Baseline: time a tiny endpoint so the reader can see the
  // proxy + HTTP/JSON floor underneath the discover endpoint.
  const baseline: number[] = [];
  for (let i = 0; i < 10; i++) {
    const t = Date.now();
    await fetch(`${API_BASE}/healthz`);
    baseline.push(Date.now() - t);
  }
  baseline.sort((a, b) => a - b);
  console.log(
    `\nBaseline /healthz over 10 iterations: min=${baseline[0]}ms p50=${baseline[5]}ms`,
  );

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t = Date.now();
    const res = await fetch(`${API_BASE}/discover/trips?limit=20`);
    const dt = Date.now() - t;
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    await res.json();
    samples.push(dt);
  }
  samples.sort((a, b) => a - b);
  const p = (q: number) => samples[Math.floor(samples.length * q)];
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  console.log(`\nFirst-page latency over ${ITERATIONS} iterations:`);
  console.log(`  min=${samples[0]}ms  p50=${p(0.5)}ms  p95=${p(0.95)}ms  max=${samples[samples.length - 1]}ms  mean=${mean.toFixed(1)}ms`);

  // Also explain the query plan to confirm the expression index is used.
  const plan = await pool.query(
    `EXPLAIN ANALYZE
     SELECT id, user_id, updated_at
       FROM trips
       WHERE is_public = true
       ORDER BY date_trunc('milliseconds', updated_at AT TIME ZONE 'UTC') DESC,
                user_id DESC,
                id DESC
       LIMIT 21`,
  );
  console.log("\nEXPLAIN ANALYZE first-page query:");
  for (const row of plan.rows) console.log("  " + row["QUERY PLAN"]);
}

async function main() {
  try {
    await seed();
    await bench();
  } finally {
    await cleanup();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  pool.end().catch(() => {});
  process.exit(1);
});
