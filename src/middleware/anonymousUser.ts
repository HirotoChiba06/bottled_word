import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { appConfig } from "../config";
import { query } from "../db/connection";

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

export async function anonymousUserMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const existingKey = typeof req.cookies?.[appConfig.cookieName] === "string"
    ? req.cookies[appConfig.cookieName]
    : undefined;
  const userKey = existingKey ?? createAnonymousUserKey();

  try {
    await query(`
      INSERT INTO anonymous_users (anonymous_user_key)
      VALUES ($1)
      ON CONFLICT (anonymous_user_key) DO UPDATE SET last_seen_at = now()
    `, [userKey]);

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
  } catch (error) {
    next(error);
  }
}
