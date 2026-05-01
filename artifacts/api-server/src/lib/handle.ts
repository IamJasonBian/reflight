import { createHash } from "node:crypto";

// Lowercase email local-part, drop +tags and dots, keep [a-z0-9_], clamp
// to 20 chars; fall back to user_<8 hex chars of sha256(clerkUserId)> if
// the derived local-part is too short. The hash avoids leaking raw
// fragments of the Clerk identifier publicly.
// Uniqueness is enforced by the caller via insert-retry.
export function deriveHandle(email: string, clerkUserId: string): string {
  const localPart = (email ?? "")
    .toLowerCase()
    .split("@")[0]
    ?.split("+")[0]
    ?.replace(/\./g, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

  if (localPart && localPart.length >= 3) {
    return localPart;
  }

  const fallbackKey = createHash("sha256")
    .update(clerkUserId)
    .digest("hex")
    .slice(0, 8);
  return `user_${fallbackKey}`;
}
