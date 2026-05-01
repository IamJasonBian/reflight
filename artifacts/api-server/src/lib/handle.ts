// Lowercase email local-part, drop +tags and dots, keep [a-z0-9_], clamp
// to 20 chars; fall back to user_<8> from clerkUserId if too short.
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

  const fallbackKey = clerkUserId
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(-8);
  return `user_${fallbackKey}`;
}
