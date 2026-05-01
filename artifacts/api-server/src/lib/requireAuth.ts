import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

// Request augmented with the Clerk user id by requireAuth.
export type AuthedRequest = Request & { userId?: string };

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = getOptionalUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

// Returns the Clerk user id when a valid session is attached, otherwise
// undefined. Used by routes that are reachable signed-out (Discover) but
// want to specialize the response when the caller is signed in.
export function getOptionalUserId(req: Request): string | undefined {
  try {
    const auth = getAuth(req);
    return (
      (auth?.sessionClaims as { userId?: string } | undefined)?.userId ||
      auth?.userId ||
      undefined
    );
  } catch {
    return undefined;
  }
}
