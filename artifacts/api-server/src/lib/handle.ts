/**
 * Public-handle derivation rules (server-only).
 *
 * Goal: take a Clerk user's primary email and produce a clean, durable,
 * URL-safe handle. We intentionally drop everything that would make handles
 * leak the full email or look noisy:
 *
 *   - lowercase the whole local-part
 *   - take the part to the left of `@`
 *   - drop everything from a `+` onwards (gmail-style sub-addresses)
 *   - strip dots
 *   - replace any other non `[a-z0-9_]` with nothing
 *   - clamp to 20 chars
 *   - if shorter than 3 chars, fall back to `user_<8 chars of clerkUserId>`
 *
 * Uniqueness is handled at insert time by the caller (suffix `2`, `3`, … on
 * a unique-violation retry). This module is intentionally pure so it can be
 * unit-tested without touching the DB or Clerk.
 */
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

  const fallbackKey = clerkUserId
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(-8);
  return `user_${fallbackKey}`;
}
