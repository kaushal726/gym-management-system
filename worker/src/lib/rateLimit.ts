/* Request limits for the routes anyone can reach: a flood from one network or one account gets "too many attempts"
 * instead of filling the database or spamming the desk. One D1 row per caller, route and time window.
 * A blocked request writes nothing. If the counter itself fails, the request goes through: a limit must never lock real users out. */
import type { Context } from "hono";
import type { AppEnv } from "../env.ts";
import { ApiError, MESSAGES } from "./http.ts";

export interface RateRule {
  /** The route this limit guards. */
  bucket: string;
  /** How many requests one caller may make in the window. */
  limit: number;
  windowSeconds: number;
}

/** Generous on purpose: a gym's members share one wifi address, and a morning rush checks in within minutes. */
export const RATE_RULES = {
  signInByNetwork: { bucket: "signin-net", limit: 60, windowSeconds: 600 },
  registerByNetwork: { bucket: "register-net", limit: 200, windowSeconds: 3600 },
  registerByUser: { bucket: "register-user", limit: 20, windowSeconds: 3600 },
  checkinByNetwork: { bucket: "checkin-net", limit: 300, windowSeconds: 600 },
  checkinByUser: { bucket: "checkin-user", limit: 30, windowSeconds: 600 },
  claimByNetwork: { bucket: "claim-net", limit: 30, windowSeconds: 600 },
} as const satisfies Record<string, RateRule>;

/** The caller's network address as Cloudflare saw it. Missing only when running locally, where nothing is limited. */
export function networkOf(c: Context<AppEnv>): string | null {
  return c.req.header("CF-Connecting-IP") ?? null;
}

/** Counts one request from `subject` against `rule`; throws 429 once the window's limit is used up. A null subject is not limited. */
export async function enforceRate(c: Context<AppEnv>, rule: RateRule, subject: string | null): Promise<void> {
  if (!subject) return;
  const windowMs = rule.windowSeconds * 1000;
  const window = Math.floor(Date.now() / windowMs);
  let counted: boolean;
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO rate_limits (key, window, n, expires_at) VALUES (?1, ?2, 1, ?3)
       ON CONFLICT (key, window) DO UPDATE SET n = n + 1 WHERE n < ?4`,
    )
      .bind(`${rule.bucket}:${subject}`, window, (window + 1) * windowMs, rule.limit)
      .run();
    counted = result.meta.changes === 1;
  } catch (err) {
    console.error("Rate limit counter failed", err);
    return;
  }
  if (!counted) throw new ApiError(429, MESSAGES.tooManyRequests, undefined, "RATE_LIMITED");
}

/** Deletes counters whose window is over. */
export async function clearExpiredRates(db: D1Database, now: number): Promise<void> {
  await db.prepare("DELETE FROM rate_limits WHERE expires_at < ?1").bind(now).run();
}
