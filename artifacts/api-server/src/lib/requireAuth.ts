import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

// Request augmented with the Clerk user id by requireAuth.
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
