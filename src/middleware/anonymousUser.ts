import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { appConfig } from "../config";
import { getDb } from "../db/connection";

declare global {
  namespace Express {
    interface Request {
      anonymousUserKey: string;
    }
  }
}

function createAnonymousUserKey(): string {
  return `anon_${crypto.randomBytes(18).toString("hex")}`;
}

export function anonymousUserMiddleware(req: Request, res: Response, next: NextFunction): void {
  const db = getDb();
  const existingKey = typeof req.cookies?.[appConfig.cookieName] === "string"
    ? req.cookies[appConfig.cookieName]
    : undefined;
  const userKey = existingKey ?? createAnonymousUserKey();

  db.prepare(`
    INSERT INTO anonymous_users (anonymous_user_key)
    VALUES (?)
    ON CONFLICT(anonymous_user_key) DO UPDATE SET last_seen_at = datetime('now')
  `).run(userKey);

  if (!existingKey) {
    res.cookie(appConfig.cookieName, userKey, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
  }

  req.anonymousUserKey = userKey;
  res.locals.anonymousUserKey = userKey;
  next();
}
