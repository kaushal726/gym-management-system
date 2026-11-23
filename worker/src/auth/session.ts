/* Our own session: a random cookie whose hash is stored in D1. HttpOnly, so page scripts never see it. */
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { SessionUser } from "../../../shared/api.ts";
import { SESSION_DAYS } from "../../../shared/constants.ts";
import type { AppEnv } from "../env.ts";
import { randomToken, sha256Hex } from "../lib/crypto.ts";
import { newId, nowIso } from "../lib/ids.ts";
import type { GoogleIdentity } from "./google.ts";

const COOKIE = "gd_session";
const DAY_MS = 86_400_000;

function cookieOptions(c: Context<AppEnv>) {
  return { httpOnly: true, sameSite: "Lax" as const, path: "/", secure: new URL(c.req.url).protocol === "https:" };
}

/** Creates or refreshes the user for a verified Google identity. */
export async function upsertUser(db: D1Database, identity: GoogleIdentity): Promise<SessionUser> {
  const now = nowIso();
  const row = await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, name, picture_url, created_at, last_login_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture_url = excluded.picture_url, last_login_at = excluded.last_login_at
       RETURNING id, email, name, picture_url`,
    )
    .bind(newId(), identity.sub, identity.email, identity.name, identity.picture, now)
    .first<{ id: string; email: string; name: string; picture_url: string | null }>();
  if (!row) throw new Error("User upsert returned nothing");
  // Staff invites are by email: the first sign-in with that email accepts them.
  await db.prepare("UPDATE gym_staff SET user_id = ?1 WHERE invite_email = ?2 AND user_id IS NULL").bind(row.id, row.email).run();
  return { id: row.id, email: row.email, name: row.name, pictureUrl: row.picture_url };
}

export async function startSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await c.env.DB.prepare("INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(await sha256Hex(token), userId, expires.toISOString(), nowIso())
    .run();
  setCookie(c, COOKIE, token, { ...cookieOptions(c), expires });
}

export async function readSession(c: Context<AppEnv>): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.picture_url FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?1 AND s.expires_at > ?2`,
  )
    .bind(await sha256Hex(token), nowIso())
    .first<{ id: string; email: string; name: string; picture_url: string | null }>();
  return row ? { id: row.id, email: row.email, name: row.name, pictureUrl: row.picture_url } : null;
}

export async function endSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(await sha256Hex(token)).run();
  deleteCookie(c, COOKIE, cookieOptions(c));
}
