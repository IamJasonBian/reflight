import { clerkClient } from "@clerk/express";

export async function fetchPrimaryEmail(userId: string): Promise<string> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  );
  if (!primary?.emailAddress) {
    throw new Error(`Clerk user ${userId} has no primary email address`);
  }
  const verified = primary.verification?.status === "verified";
  if (!verified) {
    throw new Error(
      `Clerk user ${userId} primary email is not verified yet`,
    );
  }
  return primary.emailAddress;
}
