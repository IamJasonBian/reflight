// Behavioural tests for deriveHandle (api-server/lib/handle.ts), which turns
// a Clerk user's email into a public handle. Pure (only node:crypto), so we
// exercise it directly and recompute the fallback hash to pin exact output.
import { createHash } from "node:crypto";
import { deriveHandle } from "../../artifacts/api-server/src/lib/handle.ts";

const failures: string[] = [];
function eq(label: string, actual: string, expected: string): void {
  if (actual !== expected) {
    failures.push(`${label} — expected "${expected}", got "${actual}"`);
  }
}

function fallback(clerkUserId: string): string {
  return `user_${createHash("sha256").update(clerkUserId).digest("hex").slice(0, 8)}`;
}

// Local-part is lowercased, +tags and dots stripped, clamped to 20 chars.
eq("plain email", deriveHandle("Jason.Bian@gmail.com", "u_1"), "jasonbian");
eq("drops +tag", deriveHandle("alex+promo@x.com", "u_2"), "alex");
eq(
  "strips non [a-z0-9_]",
  deriveHandle("a!b#c$d@x.com", "u_3"),
  "abcd",
);
eq("keeps digits and underscore", deriveHandle("a_b1@x.com", "u_4"), "a_b1");
eq(
  "clamps to 20 chars",
  deriveHandle("abcdefghijklmnopqrstuvwxyz@x.com", "u_5"),
  "abcdefghijklmnopqrst",
);

// When the derived local-part is < 3 chars, fall back to user_<hash>.
eq("short local-part falls back", deriveHandle("ab@x.com", "clerk_42"), fallback("clerk_42"));
eq("empty email falls back", deriveHandle("", "clerk_99"), fallback("clerk_99"));
eq(
  "fallback is deterministic per clerkUserId",
  deriveHandle("a@x.com", "clerk_42"),
  deriveHandle("", "clerk_42"),
);

if (failures.length > 0) {
  console.error("FAIL: deriveHandle regressed:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("PASS: deriveHandle — local-part normalisation + user_<hash> fallback");
