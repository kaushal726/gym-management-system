import { Hono } from "hono";
import type { AppConfig, SessionInfo, StaffGym } from "../../../shared/api.ts";
import type { AppEnv } from "../env.ts";
import { verifyGoogleIdToken } from "../auth/google.ts";
import { endSession, startSession, upsertUser } from "../auth/session.ts";
import { currentUser, isPlatformAdmin, requireUser } from "../auth/guards.ts";
import { ApiError, badInput, notFound } from "../lib/http.ts";
import { asBody, email, text } from "../lib/validate.ts";
import { nowIso } from "../lib/ids.ts";
import { accessOf, type GymRow } from "../db/rows.ts";
import { isPushServiceUrl } from "../push/endpoint.ts";

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/config", (c) => {
  const config: AppConfig = {
    googleClientId: c.env.GOOGLE_CLIENT_ID || null,
    devLogin: c.env.DEV_AUTH === "1",
    vapidPublicKey: c.env.VAPID_PUBLIC_KEY || null,
    allowGymSignup: c.env.ALLOW_GYM_SIGNUP === "1",
  };
  return c.json(config);
});

authRoutes.get("/session", async (c) => {
  const user = c.get("user");
  if (!user) return c.json<SessionInfo>({ user: null, staffOf: [], memberOf: [], isPlatformAdmin: false });
  const [staff, members] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT g.id AS gym_id, g.name AS gym_name, g.slug AS gym_slug, g.status, g.valid_till, g.timezone, st.role FROM gym_staff st JOIN gyms g ON g.id = st.gym_id
       WHERE st.user_id = ?1 AND st.active = 1 ORDER BY g.name`,
    ).bind(user.id),
    c.env.DB.prepare(
      `SELECT g.id AS gym_id, g.name AS gym_name, g.slug AS gym_slug, m.id AS member_id, m.status FROM members m JOIN gyms g ON g.id = m.gym_id
       WHERE m.user_id = ?1 AND m.anonymised_at IS NULL ORDER BY g.name`,
    ).bind(user.id),
  ]);
  type StaffJoin = { gym_id: string; gym_name: string; gym_slug: string; role: StaffGym["role"]; status: GymRow["status"]; valid_till: string | null; timezone: string };
  type MemberJoin = { gym_id: string; gym_name: string; gym_slug: string; member_id: string; status: SessionInfo["memberOf"][number]["status"] };
  return c.json<SessionInfo>({
    user,
    staffOf: (staff.results as StaffJoin[]).map((s) => ({ gymId: s.gym_id, gymName: s.gym_name, gymSlug: s.gym_slug, role: s.role, access: accessOf(s), validTill: s.valid_till })),
    memberOf: (members.results as MemberJoin[]).map((m) => ({ gymId: m.gym_id, gymName: m.gym_name, gymSlug: m.gym_slug, memberId: m.member_id, status: m.status })),
    isPlatformAdmin: isPlatformAdmin(c.env, user.email),
  });
});

authRoutes.post("/google", async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError(503, "Google sign-in is not set up yet.");
  const body = asBody(await c.req.json());
  const identity = await verifyGoogleIdToken(text(body, "credential", { max: 4096 }), clientId);
  const user = await upsertUser(c.env.DB, identity);
  await startSession(c, user.id);
  return c.json({ ok: true });
});

/** Local development only: sign in as any email without Google. Disabled unless DEV_AUTH=1 in .dev.vars. */
/** Development sign-in works only on this machine, and only for made-up .test addresses, so it can never
 * stand in for a real Gmail even if DEV_AUTH were set by mistake on a deployed Worker. */
const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEV_EMAIL = /@[a-z0-9.-]+\.test$/;

authRoutes.post("/dev", async (c) => {
  if (c.env.DEV_AUTH !== "1" || !DEV_HOSTS.has(new URL(c.req.url).hostname)) throw notFound();
  const body = asBody(await c.req.json());
  const address = email(body, "email");
  if (!DEV_EMAIL.test(address)) throw badInput("email", "Local sign-in only accepts test addresses like name@gymdesk.test. Use Google for real accounts.");
  const user = await upsertUser(c.env.DB, { sub: `dev:${address}`, email: address, name: text(body, "name", { max: 80 }), picture: null });
  await startSession(c, user.id);
  return c.json({ ok: true });
});

authRoutes.post("/logout", async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});

/** Saves this browser's push subscription for the signed-in user. */
authRoutes.post("/push/subscribe", requireUser, async (c) => {
  const user = currentUser(c);
  const body = asBody(await c.req.json());
  const endpoint = text(body, "endpoint", { max: 1024 });
  if (!isPushServiceUrl(endpoint)) throw new ApiError(400, "Notifications could not be turned on.", "endpoint");
  const keys = asBody(body.keys);
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
  )
    .bind(endpoint, user.id, text(keys, "p256dh", { max: 200 }), text(keys, "auth", { max: 100 }), nowIso())
    .run();
  return c.json({ ok: true });
});

authRoutes.post("/push/unsubscribe", requireUser, async (c) => {
  const user = currentUser(c);
  const body = asBody(await c.req.json());
  await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?1 AND user_id = ?2").bind(text(body, "endpoint", { max: 1024 }), user.id).run();
  return c.json({ ok: true });
});
