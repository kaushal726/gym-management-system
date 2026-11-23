/* SaaS onboarding: the platform admin creates gyms; with ALLOW_GYM_SIGNUP=1 anyone signed in can create their own. */
import { Hono } from "hono";
import type { PlatformGym } from "../../../shared/api.ts";
import { DEFAULT_GRACE_DAYS, DEFAULT_REMINDER_HOUR, DEFAULT_TIME_ZONE, SLUG_PATTERN } from "../../../shared/constants.ts";
import type { AppEnv } from "../env.ts";
import { currentUser, isPlatformAdmin, requirePlatformAdmin, requireUser } from "../auth/guards.ts";
import { auditStatement } from "../lib/audit.ts";
import { ApiError, badInput, forbidden } from "../lib/http.ts";
import { newId, nowIso } from "../lib/ids.ts";
import { asBody, email, optionalText, text, type Body } from "../lib/validate.ts";

export const platformRoutes = new Hono<AppEnv>();

/** Slugs that would clash with app routes or look official. */
const RESERVED_SLUGS = new Set(["admin", "api", "app", "me", "claim", "platform", "new", "login", "www", "support", "help"]);

async function createGym(db: D1Database, body: Body, ownerEmail: string, actorId: string): Promise<string> {
  const slug = text(body, "slug", { max: 40 }).toLowerCase();
  if (!SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug)) throw badInput("slug", "Use 3-40 lowercase letters, numbers or dashes.");
  const taken = await db.prepare("SELECT 1 FROM gyms WHERE slug = ?1").bind(slug).first();
  if (taken) throw new ApiError(409, "This web address is taken. Try another.", "slug");
  const id = newId();
  const now = nowIso();
  const name = text(body, "name", { max: 80 });
  const owner = await db.prepare("SELECT id FROM users WHERE email = ?1").bind(ownerEmail).first<{ id: string }>();
  await db.batch([
    db.prepare(
      `INSERT INTO gyms (id, slug, name, phone, address, timezone, grace_days, reminder_hour, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    ).bind(id, slug, name, optionalText(body, "phone", { max: 20 }), optionalText(body, "address", { max: 200 }), DEFAULT_TIME_ZONE, DEFAULT_GRACE_DAYS, DEFAULT_REMINDER_HOUR, actorId, now),
    db.prepare("INSERT INTO gym_staff (gym_id, invite_email, user_id, role, active, created_by, created_at) VALUES (?1, ?2, ?3, 'OWNER', 1, ?4, ?5)").bind(id, ownerEmail, owner?.id ?? null, actorId, now),
    auditStatement(db, { gymId: id, actorId, action: "GYM_CREATE", entity: "gym", entityId: id, after: { name, slug, ownerEmail } }),
  ]);
  return id;
}

platformRoutes.get("/gyms", requirePlatformAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.slug, g.name, g.created_at,
       (SELECT GROUP_CONCAT(invite_email) FROM gym_staff st WHERE st.gym_id = g.id AND st.role = 'OWNER' AND st.active = 1) AS owners,
       (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id AND m.status = 'JOINED') AS member_count
     FROM gyms g ORDER BY g.created_at DESC`,
  ).all<{ id: string; slug: string; name: string; created_at: string; owners: string | null; member_count: number }>();
  return c.json<{ items: PlatformGym[] }>({
    items: results.map((r) => ({ id: r.id, slug: r.slug, name: r.name, createdAt: r.created_at, ownerEmails: r.owners ? r.owners.split(",") : [], memberCount: r.member_count })),
  });
});

platformRoutes.post("/gyms", requirePlatformAdmin, async (c) => {
  const user = currentUser(c);
  const body = asBody(await c.req.json());
  const id = await createGym(c.env.DB, body, email(body, "ownerEmail"), user.id);
  return c.json({ id }, 201);
});

/** Self-serve: a signed-in person creates a gym and becomes its owner. */
platformRoutes.post("/signup-gym", requireUser, async (c) => {
  const user = currentUser(c);
  if (c.env.ALLOW_GYM_SIGNUP !== "1" && !isPlatformAdmin(c.env, user.email)) throw forbidden();
  const id = await createGym(c.env.DB, asBody(await c.req.json()), user.email, user.id);
  return c.json({ id }, 201);
});
