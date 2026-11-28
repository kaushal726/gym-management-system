/* The SaaS console for the platform admin: onboard gyms with one owner each, see their health (never their
 * money), set the gym's own plan and valid-till date, pause/resume, archive, edit details, change the owner.
 * Self-serve signup (ALLOW_GYM_SIGNUP=1) uses the same createGym. */
import { Hono, type Context } from "hono";
import type { GymOverview, MemberFilter, MemberListItem, PlatformGym, PlatformGymDetail, Plan } from "../../../shared/api.ts";
import { MEMBER_FILTERS } from "../../../shared/api.ts";
import { DEFAULT_GRACE_DAYS, DEFAULT_REMINDER_HOUR, DEFAULT_TIME_ZONE, SLUG_PATTERN } from "../../../shared/constants.ts";
import { todayIn } from "../../../shared/dates.ts";
import { MAX_AMOUNT_PAISE } from "../../../shared/money.ts";
import { SAAS_PAYMENT_MODES } from "../../../shared/saas.ts";
import type { AppEnv, Env } from "../env.ts";
import { currentUser, isPlatformAdmin, requirePlatformAdmin, requireUser } from "../auth/guards.ts";
import { auditStatement } from "../lib/audit.ts";
import { ApiError, badInput, conflict, forbidden, notFound } from "../lib/http.ts";
import { newId, nowIso } from "../lib/ids.ts";
import { asBody, date, email, int, oneOf, optionalDate, optionalText, text, type Body } from "../lib/validate.ts";
import { accessOf, toGymSettings, toPlan, type GymRow, type PlanRow } from "../db/rows.ts";
import { loadRoster, paymentsBetween, toListItem } from "../db/queries.ts";
import { matchesFilter, matchesSearch } from "../../../shared/filters.ts";
import { summarizeCollection } from "./admin/gym.ts";

export const platformRoutes = new Hono<AppEnv>();

/** Slugs that would clash with app routes or look official. */
const RESERVED_SLUGS = new Set(["admin", "api", "app", "me", "claim", "platform", "new", "login", "www", "support", "help", "poster", "g"]);

function readSlug(body: Body): string {
  const slug = text(body, "slug", { max: 40 }).toLowerCase();
  if (!SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug)) throw badInput("slug", "Use 3-40 lowercase letters, numbers or dashes.");
  return slug;
}

async function ensureSlugFree(db: D1Database, slug: string, exceptGymId?: string): Promise<void> {
  const taken = await db.prepare("SELECT id FROM gyms WHERE slug = ?1").bind(slug).first<{ id: string }>();
  if (taken && taken.id !== exceptGymId) throw new ApiError(409, "This web address is taken. Try another.", "slug");
}

/** The platform admin's own email never owns a gym, so the console and a gym never mix. */
function readOwnerEmail(env: Env, body: Body, field: string): string {
  const address = email(body, field);
  if (isPlatformAdmin(env, address)) throw badInput(field, "Use the gym owner's own Gmail. The platform admin email can't own a gym.");
  return address;
}

async function createGym(env: Env, body: Body, ownerEmail: string, actorId: string, plan: { name: string | null; validTill: string | null }): Promise<string> {
  const db = env.DB;
  const slug = readSlug(body);
  await ensureSlugFree(db, slug);
  const id = newId();
  const now = nowIso();
  const name = text(body, "name", { max: 80 });
  const owner = await db.prepare("SELECT id FROM users WHERE email = ?1").bind(ownerEmail).first<{ id: string }>();
  await db.batch([
    db.prepare(
      `INSERT INTO gyms (id, slug, name, phone, address, timezone, grace_days, reminder_hour, saas_plan_name, valid_till, created_by, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    ).bind(
      id,
      slug,
      name,
      optionalText(body, "phone", { max: 20 }),
      optionalText(body, "address", { max: 200 }),
      DEFAULT_TIME_ZONE,
      DEFAULT_GRACE_DAYS,
      DEFAULT_REMINDER_HOUR,
      plan.name,
      plan.validTill,
      actorId,
      now,
    ),
    db.prepare("INSERT INTO gym_staff (gym_id, invite_email, user_id, role, active, created_by, created_at) VALUES (?1, ?2, ?3, 'OWNER', 1, ?4, ?5)").bind(id, ownerEmail, owner?.id ?? null, actorId, now),
    auditStatement(db, { gymId: id, actorId, action: "GYM_CREATE", entity: "gym", entityId: id, after: { name, slug, ownerEmail, plan: plan.name, validTill: plan.validTill } }),
  ]);
  return id;
}

interface GymListRow extends GymRow {
  owner_email: string | null;
  owner_last_login_at: string | null;
  members: number;
  active_members: number;
  pending: number;
  staff: number;
  last_activity_at: string | null;
}

/** One query for every gym's health numbers. Counts only, never money. `?1` is today in India. */
const GYM_LIST_SQL = `
  SELECT g.*,
    (SELECT st.invite_email FROM gym_staff st WHERE st.gym_id = g.id AND st.role = 'OWNER' AND st.active = 1) AS owner_email,
    (SELECT u.last_login_at FROM gym_staff st JOIN users u ON u.id = st.user_id WHERE st.gym_id = g.id AND st.role = 'OWNER' AND st.active = 1) AS owner_last_login_at,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id AND m.status = 'JOINED' AND m.archived_at IS NULL AND m.anonymised_at IS NULL) AS members,
    (SELECT COUNT(DISTINCT s.member_id) FROM subscriptions s WHERE s.gym_id = g.id AND s.kind = 'MEMBERSHIP' AND s.cancelled_at IS NULL
       AND ?1 BETWEEN s.start_date AND s.end_date) AS active_members,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id AND m.status = 'PENDING' AND m.archived_at IS NULL) AS pending,
    (SELECT COUNT(*) FROM gym_staff st WHERE st.gym_id = g.id AND st.active = 1) AS staff,
    (SELECT MAX(a.at) FROM audit_log a WHERE a.gym_id = g.id) AS last_activity_at
  FROM gyms g`;

function toPlatformGym(r: GymListRow): PlatformGym {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    status: r.status,
    access: accessOf(r),
    validTill: r.valid_till,
    saasPlanName: r.saas_plan_name,
    ownerEmail: r.owner_email,
    ownerLastLoginAt: r.owner_last_login_at,
    members: r.members,
    activeMembers: r.active_members,
    pending: r.pending,
    staff: r.staff,
    lastActivityAt: r.last_activity_at,
    createdAt: r.created_at,
  };
}

async function gymOr404(db: D1Database, gymId: string): Promise<GymListRow> {
  const row = await db.prepare(`${GYM_LIST_SQL} WHERE g.id = ?2`).bind(todayIn(DEFAULT_TIME_ZONE), gymId).first<GymListRow>();
  if (!row) throw notFound();
  return row;
}

platformRoutes.get("/gyms", requirePlatformAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(`${GYM_LIST_SQL} ORDER BY g.created_at DESC`).bind(todayIn(DEFAULT_TIME_ZONE)).all<GymListRow>();
  return c.json<{ items: PlatformGym[] }>({ items: results.map(toPlatformGym) });
});

platformRoutes.get("/gyms/:id", requirePlatformAdmin, async (c) => {
  const gym = await gymOr404(c.env.DB, c.req.param("id"));
  const [staff, billing] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT st.invite_email, st.role, st.active, st.user_id, u.name, u.last_login_at FROM gym_staff st LEFT JOIN users u ON u.id = st.user_id
       WHERE st.gym_id = ?1 ORDER BY st.active DESC, st.role DESC, st.invite_email`,
    ).bind(gym.id),
    c.env.DB.prepare("SELECT * FROM gym_billing WHERE gym_id = ?1 ORDER BY created_at DESC").bind(gym.id),
  ]);
  type StaffJoin = { invite_email: string; role: "OWNER" | "MANAGER" | "TRAINER"; active: number; user_id: string | null; name: string | null; last_login_at: string | null };
  type BillingRow = { id: string; plan_name: string; amount_paise: number; mode: (typeof SAAS_PAYMENT_MODES)[number]; paid_on: string; valid_till_before: string | null; valid_till_after: string; note: string | null; created_at: string };
  return c.json<PlatformGymDetail>({
    today: todayIn(DEFAULT_TIME_ZONE),
    gym: { ...toPlatformGym(gym), phone: gym.phone, address: gym.address, statusReason: gym.status_reason, statusChangedAt: gym.status_changed_at },
    staff: (staff.results as StaffJoin[]).map((s) => ({ email: s.invite_email, userName: s.name, role: s.role, active: s.active === 1, linked: s.user_id != null, lastLoginAt: s.last_login_at })),
    billing: (billing.results as BillingRow[]).map((b) => ({
      id: b.id,
      planName: b.plan_name,
      amountPaise: b.amount_paise,
      mode: b.mode,
      paidOn: b.paid_on,
      validTillBefore: b.valid_till_before,
      validTillAfter: b.valid_till_after,
      note: b.note,
      createdAt: b.created_at,
    })),
  });
});

/**
 * The owner's view for the platform admin, read-only: the gym's numbers, plans and settings here, and its member list
 * below (same rows the owner sees). No member detail, payments or follow-ups, and nothing can be changed from here.
 */
platformRoutes.get("/gyms/:id/overview", requirePlatformAdmin, async (c) => {
  const gym = await c.env.DB.prepare("SELECT * FROM gyms WHERE id = ?1").bind(c.req.param("id")).first<GymRow>();
  if (!gym) throw notFound();
  const today = todayIn(gym.timezone);
  const [roster, plans, payments] = await Promise.all([
    loadRoster(c.env.DB, gym, today),
    c.env.DB.prepare("SELECT * FROM plans WHERE gym_id = ?1 ORDER BY active DESC, kind, price_paise").bind(gym.id).all<PlanRow>(),
    paymentsBetween(c.env.DB, gym.id, `${today.slice(0, 8)}01`, today),
  ]);
  const items = roster.map((e) => toListItem(e, today));
  const count = (f: Parameters<typeof matchesFilter>[1]) => items.filter((i) => matchesFilter(i, f)).length;
  const todayRows = summarizeCollection(payments.filter((r) => r.paid_on === today));
  return c.json<GymOverview>({
    today,
    counts: {
      active: count("active"),
      expiringSoon: count("expiring"),
      grace: count("grace"),
      expired: count("expired"),
      frozen: count("frozen"),
      pending: count("pending"),
      withDues: count("dues"),
    },
    duesTotalPaise: items.filter((i) => !i.archived).reduce((sum, i) => sum + i.duePaise, 0),
    collectedTodayPaise: todayRows.totalPaise,
    collectedMonthPaise: summarizeCollection(payments).totalPaise,
    collectedTodayByMode: todayRows.byMode,
    plans: plans.results.map(toPlan) satisfies Plan[],
    settings: toGymSettings(gym),
  });
});

platformRoutes.get("/gyms/:id/members", requirePlatformAdmin, async (c) => {
  const gym = await c.env.DB.prepare("SELECT * FROM gyms WHERE id = ?1").bind(c.req.param("id")).first<GymRow>();
  if (!gym) throw notFound();
  const today = todayIn(gym.timezone);
  const filterParam = c.req.query("filter") ?? "all";
  const filter: MemberFilter = (MEMBER_FILTERS as readonly string[]).includes(filterParam) ? (filterParam as MemberFilter) : "all";
  const items = (await loadRoster(c.env.DB, gym, today)).map((e) => toListItem(e, today));
  const counts = Object.fromEntries(MEMBER_FILTERS.map((f) => [f, items.filter((i) => matchesFilter(i, f)).length])) as Record<MemberFilter, number>;
  return c.json<{ items: MemberListItem[]; counts: Record<MemberFilter, number> }>({ items: items.filter((i) => matchesFilter(i, filter) && matchesSearch(i, c.req.query("q") ?? "")), counts });
});

platformRoutes.post("/gyms", requirePlatformAdmin, async (c) => {
  const user = currentUser(c);
  const body = asBody(await c.req.json());
  const id = await createGym(c.env, body, readOwnerEmail(c.env, body, "ownerEmail"), user.id, {
    name: optionalText(body, "saasPlanName", { max: 60 }),
    validTill: optionalDate(body, "validTill"),
  });
  return c.json({ id }, 201);
});

platformRoutes.patch("/gyms/:id", requirePlatformAdmin, async (c) => {
  const user = currentUser(c);
  const gym = await gymOr404(c.env.DB, c.req.param("id"));
  const body = asBody(await c.req.json());
  const next = { name: text(body, "name", { max: 80 }), slug: readSlug(body), phone: optionalText(body, "phone", { max: 20 }), address: optionalText(body, "address", { max: 200 }) };
  await ensureSlugFree(c.env.DB, next.slug, gym.id);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE gyms SET name = ?1, slug = ?2, phone = ?3, address = ?4 WHERE id = ?5").bind(next.name, next.slug, next.phone, next.address, gym.id),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "PLATFORM_GYM_EDIT", entity: "gym", entityId: gym.id, before: { name: gym.name, slug: gym.slug, phone: gym.phone, address: gym.address }, after: next }),
  ]);
  return c.json({ ok: true });
});

/** Pause, resume, archive and restore are one status change each, always with a reason in the audit log. */
function statusRoute(to: GymRow["status"], allowedFrom: GymRow["status"][], action: string) {
  return async (c: Context<AppEnv>) => {
    const user = currentUser(c);
    const gym = await gymOr404(c.env.DB, c.req.param("id")!);
    if (!allowedFrom.includes(gym.status)) throw conflict("This gym can't be changed that way right now.");
    const reason = text(asBody(await c.req.json()), "reason", { max: 200 });
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE gyms SET status = ?1, status_reason = ?2, status_changed_at = ?3 WHERE id = ?4").bind(to, reason, nowIso(), gym.id),
      auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action, entity: "gym", entityId: gym.id, before: { status: gym.status }, after: { status: to }, reason }),
    ]);
    return c.json({ ok: true });
  };
}

platformRoutes.post("/gyms/:id/pause", requirePlatformAdmin, statusRoute("PAUSED", ["ACTIVE"], "PLATFORM_GYM_PAUSE"));
platformRoutes.post("/gyms/:id/resume", requirePlatformAdmin, statusRoute("ACTIVE", ["PAUSED"], "PLATFORM_GYM_RESUME"));
platformRoutes.post("/gyms/:id/archive", requirePlatformAdmin, statusRoute("ARCHIVED", ["ACTIVE", "PAUSED"], "PLATFORM_GYM_ARCHIVE"));
platformRoutes.post("/gyms/:id/restore", requirePlatformAdmin, statusRoute("ACTIVE", ["ARCHIVED"], "PLATFORM_GYM_RESTORE"));

/** Hands the gym to a new owner email. The old owner loses access at once. */
platformRoutes.post("/gyms/:id/owner", requirePlatformAdmin, async (c) => {
  const user = currentUser(c);
  const gym = await gymOr404(c.env.DB, c.req.param("id"));
  const body = asBody(await c.req.json());
  const ownerEmail = readOwnerEmail(c.env, body, "email");
  if (ownerEmail === gym.owner_email) throw badInput("email", "This is already the owner's email.");
  const reason = text(body, "reason", { max: 200 });
  const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?1").bind(ownerEmail).first<{ id: string }>();
  await c.env.DB.batch([
    // Old owner off first, so the one-active-owner index is never broken mid-batch.
    c.env.DB.prepare("UPDATE gym_staff SET active = 0 WHERE gym_id = ?1 AND role = 'OWNER' AND active = 1").bind(gym.id),
    c.env.DB.prepare(
      `INSERT INTO gym_staff (gym_id, invite_email, user_id, role, active, created_by, created_at) VALUES (?1, ?2, ?3, 'OWNER', 1, ?4, ?5)
       ON CONFLICT (gym_id, invite_email) DO UPDATE SET role = 'OWNER', active = 1, user_id = COALESCE(gym_staff.user_id, excluded.user_id)`,
    ).bind(gym.id, ownerEmail, existingUser?.id ?? null, user.id, nowIso()),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "PLATFORM_OWNER_CHANGE", entity: "gym", entityId: gym.id, before: { owner: gym.owner_email }, after: { owner: ownerEmail }, reason }),
  ]);
  return c.json({ ok: true });
});

/** Records what the gym paid for GymDesk and moves its valid-till date. */
platformRoutes.post("/gyms/:id/billing", requirePlatformAdmin, async (c) => {
  const user = currentUser(c);
  const gym = await gymOr404(c.env.DB, c.req.param("id"));
  const body = asBody(await c.req.json());
  const entry = {
    planName: text(body, "planName", { max: 60 }),
    amountPaise: int(body, "amountPaise", 0, MAX_AMOUNT_PAISE),
    mode: oneOf(body, "mode", SAAS_PAYMENT_MODES),
    paidOn: date(body, "paidOn"),
    validTill: date(body, "validTill"),
    note: optionalText(body, "note", { max: 200 }),
  };
  const id = newId();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO gym_billing (id, gym_id, plan_name, amount_paise, mode, paid_on, valid_till_before, valid_till_after, note, created_by, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    ).bind(id, gym.id, entry.planName, entry.amountPaise, entry.mode, entry.paidOn, gym.valid_till, entry.validTill, entry.note, user.id, nowIso()),
    c.env.DB.prepare("UPDATE gyms SET saas_plan_name = ?1, valid_till = ?2 WHERE id = ?3").bind(entry.planName, entry.validTill, gym.id),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "PLATFORM_BILLING", entity: "gym", entityId: gym.id, before: { validTill: gym.valid_till }, after: entry }),
  ]);
  return c.json({ id }, 201);
});

/** Self-serve: a signed-in person creates a gym and becomes its owner (only when ALLOW_GYM_SIGNUP=1). */
platformRoutes.post("/signup-gym", requireUser, async (c) => {
  const user = currentUser(c);
  if (c.env.ALLOW_GYM_SIGNUP !== "1" || isPlatformAdmin(c.env, user.email)) throw forbidden();
  const id = await createGym(c.env, asBody(await c.req.json()), user.email, user.id, { name: null, validTill: null });
  return c.json({ id }, 201);
});
