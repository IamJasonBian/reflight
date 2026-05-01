import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

/**
 * Augment Express's Request with the resolved Clerk user id once
 * `requireAuth` has run. Routes that come *after* the middleware can safely
 * read `req.userId` without re-deriving it from the Clerk session claims.
 */
export type AuthedRequest = Request & { userId?: string };

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  const userId =
    (auth?.sessionClaims as { userId?: string } | undefined)?.userId ||
    auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}
