/* Gym-wide screens: today's dashboard, follow-ups, plans, settings, staff, audit log, reports and exports. */
import { Hono } from "hono";
import type { AuditEntry, CollectionSummary, CollectionsReport, Dashboard, Followup, GymSettings, Plan, StaffEntry } from "../../../../shared/api.ts";
import { BATCHES, DEFAULT_CHECKIN_RADIUS_M, FOLLOWUP_LOOKBACK_DAYS, MAX_FREEZE_DAYS, MAX_GRACE_DAYS, PLAN_KINDS, TEAM_ROLES, parseBatches, type Batch, type PaymentMode } from "../../../../shared/constants.ts";
import { addDays, isIsoDate, isValidTimeZone, todayIn } from "../../../../shared/dates.ts";
import { matchesFilter } from "../../../../shared/filters.ts";
import { MAX_AMOUNT_PAISE } from "../../../../shared/money.ts";
import { REMINDER_LABEL, type ReminderType } from "../../../../shared/reminders.ts";
import { whatsappText } from "../../../../shared/renewalMessage.ts";
import type { AppEnv } from "../../env.ts";
import { currentStaff, currentUser, ownerOnly } from "../../auth/guards.ts";
import { auditStatement } from "../../lib/audit.ts";
import { ApiError, badInput, conflict, notFound } from "../../lib/http.ts";
import { newId, nowIso } from "../../lib/ids.ts";
import { asBody, bool, email, int, oneOf, optionalInt, optionalNum, optionalText, paise, text, type Body } from "../../lib/validate.ts";
import { loadRoster, paymentsBetween, toListItem } from "../../db/queries.ts";
import { toGymSettings, toPayment, toPlan, type PlanRow } from "../../db/rows.ts";
import { toCsv } from "../../lib/csv.ts";
import { notifyUsers, ownerUserIds } from "../../push/notify.ts";

export const gymRoutes = new Hono<AppEnv>();

/** How many rows the dashboard previews in each list. */
const DASHBOARD_PREVIEW = 5;
const AUDIT_PAGE = 50;
const MAX_REPORT_DAYS = 370;

function summarizeCollection(rows: { amount_paise: number; mode: PaymentMode; collected_by_name: string | null; voided_at: string | null }[]): CollectionSummary {
  const byMode: Record<PaymentMode, number> = { CASH: 0, UPI: 0, CARD: 0 };
  const byStaff = new Map<string, { totalPaise: number; count: number }>();
  let totalPaise = 0;
  let count = 0;
  for (const r of rows) {
    if (r.voided_at) continue;
    totalPaise += r.amount_paise;
    count += 1;
    byMode[r.mode] += r.amount_paise;
    const name = r.collected_by_name ?? "Unknown";
    const s = byStaff.get(name) ?? { totalPaise: 0, count: 0 };
    s.totalPaise += r.amount_paise;
    s.count += 1;
    byStaff.set(name, s);
  }
  return { totalPaise, count, byMode, byStaff: [...byStaff].map(([name, s]) => ({ name, ...s })).sort((a, b) => b.totalPaise - a.totalPaise) };
}

gymRoutes.get("/dashboard", async (c) => {
  const { gym, role } = currentStaff(c);
  const today = todayIn(gym.timezone);
  const owner = role === "OWNER";
  const [roster, followups, checkins] = await Promise.all([
    loadRoster(c.env.DB, gym, today),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM followups WHERE gym_id = ?1 AND contacted_at IS NULL AND for_date >= ?2").bind(gym.id, addDays(today, -FOLLOWUP_LOOKBACK_DAYS)).first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM attendance WHERE gym_id = ?1 AND day = ?2").bind(gym.id, today).first<{ n: number }>(),
  ]);
  const items = roster.map((e) => toListItem(e, today));
  const count = (f: Parameters<typeof matchesFilter>[1]) => items.filter((i) => matchesFilter(i, f)).length;
  let collectionToday: CollectionSummary | null = null;
  let collectionMonthPaise: number | null = null;
  if (owner) {
    const monthStart = `${today.slice(0, 8)}01`;
    const rows = await paymentsBetween(c.env.DB, gym.id, monthStart, today);
    collectionToday = summarizeCollection(rows.filter((r) => r.paid_on === today));
    collectionMonthPaise = summarizeCollection(rows).totalPaise;
  }
  const expiring = items.filter((i) => matchesFilter(i, "expiring")).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  return c.json<Dashboard>({
    today,
    role,
    counts: {
      active: count("active"),
      expiringSoon: expiring.length,
      grace: count("grace"),
      expired: count("expired"),
      frozen: count("frozen"),
      pending: count("pending"),
      withDues: count("dues"),
      openFollowups: followups?.n ?? 0,
      checkinsToday: checkins?.n ?? 0,
    },
    duesTotalPaise: items.filter((i) => !i.archived).reduce((sum, i) => sum + i.duePaise, 0),
    pending: items.filter((i) => matchesFilter(i, "pending")).slice(0, DASHBOARD_PREVIEW),
    expiringSoon: expiring.slice(0, DASHBOARD_PREVIEW),
    collectionToday,
    collectionMonthPaise,
  });
});

gymRoutes.get("/followups", async (c) => {
  const { gym } = currentStaff(c);
  const today = todayIn(gym.timezone);
  const done = c.req.query("view") === "done";
  const since = addDays(today, -FOLLOWUP_LOOKBACK_DAYS);
  const [rows, roster] = await Promise.all([
    c.env.DB.prepare(
      `SELECT f.*, m.name AS member_name, m.phone AS member_phone, u.name AS contacted_by_name FROM followups f JOIN members m ON m.id = f.member_id
       LEFT JOIN users u ON u.id = f.contacted_by
       WHERE f.gym_id = ?1 AND f.for_date >= ?2 AND m.anonymised_at IS NULL AND m.archived_at IS NULL AND (f.contacted_at IS ${done ? "NOT NULL" : "NULL"})
       ORDER BY f.for_date DESC LIMIT 300`,
    )
      .bind(gym.id, since)
      .all<{
        id: string;
        type: ReminderType;
        for_date: string;
        push_failed: number;
        contacted_at: string | null;
        contacted_by_name: string | null;
        note: string | null;
        member_id: string;
        member_name: string;
        member_phone: string;
      }>(),
    loadRoster(c.env.DB, gym, today),
  ]);
  const byMember = new Map(roster.map((e) => [e.member.id, e]));
  const items: Followup[] = rows.results.map((r) => {
    const entry = byMember.get(r.member_id);
    const chainEnd = entry?.standing.membership.chainEnd;
    const message = whatsappText(r.type, {
      memberName: r.member_name,
      gymName: gym.name,
      endDate: chainEnd?.endDate ?? null,
      planName: chainEnd?.planName ?? null,
      duePaise: entry?.standing.duePaise ?? 0,
    });
    return {
      id: r.id,
      type: r.type,
      label: REMINDER_LABEL[r.type],
      forDate: r.for_date,
      pushFailed: r.push_failed === 1,
      contactedAt: r.contacted_at,
      contactedByName: r.contacted_by_name,
      note: r.note,
      member: { id: r.member_id, name: r.member_name, phone: r.member_phone },
      message,
    };
  });
  return c.json({ items });
});

gymRoutes.post("/followups/:followupId/contacted", async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const note = optionalText(asBody(await c.req.json()), "note", { max: 300 });
  const result = await c.env.DB.prepare("UPDATE followups SET contacted_at = ?1, contacted_by = ?2, note = ?3 WHERE id = ?4 AND gym_id = ?5 AND contacted_at IS NULL")
    .bind(nowIso(), user.id, note, c.req.param("followupId"), gym.id)
    .run();
  if (!result.meta.changes) throw notFound();
  return c.json({ ok: true });
});

gymRoutes.get("/settings", (c) => c.json<GymSettings>(toGymSettings(currentStaff(c).gym)));

gymRoutes.patch("/settings", async (c) => {
  const { gym, role } = currentStaff(c);
  const user = currentUser(c);
  const body = asBody(await c.req.json());
  const timezone = text(body, "timezone", { max: 64 });
  if (!isValidTimeZone(timezone)) throw badInput("timezone");
  const lat = optionalNum(body, "checkinLat", -90, 90);
  const lng = optionalNum(body, "checkinLng", -180, 180);
  if ((lat == null) !== (lng == null)) throw badInput("checkinLat");
  const upiId = optionalText(body, "upiId", { max: 100 });
  if (upiId && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) throw badInput("upiId", "Please enter a valid UPI ID, like name@bank.");
  const next = {
    name: text(body, "name", { max: 80 }),
    phone: optionalText(body, "phone", { max: 20 }),
    address: optionalText(body, "address", { max: 200 }),
    timezone,
    upiId,
    graceDays: int(body, "graceDays", 0, MAX_GRACE_DAYS),
    joiningFeePaise: paise(body, "joiningFeePaise"),
    checkinEnabled: bool(body, "checkinEnabled"),
    checkinLat: lat,
    checkinLng: lng,
    checkinRadiusM: lat == null ? null : (optionalInt(body, "checkinRadiusM", 30, 5000) ?? DEFAULT_CHECKIN_RADIUS_M),
    reminderHour: int(body, "reminderHour", 5, 22),
    batches: readBatches(body, parseBatches(gym.batches)),
  };
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE gyms SET name = ?1, phone = ?2, address = ?3, timezone = ?4, upi_id = ?5, grace_days = ?6, joining_fee_paise = ?7, checkin_enabled = ?8,
         checkin_lat = ?9, checkin_lng = ?10, checkin_radius_m = ?11, reminder_hour = ?12, batches = ?13 WHERE id = ?14`,
    ).bind(
      next.name,
      next.phone,
      next.address,
      next.timezone,
      next.upiId,
      next.graceDays,
      next.joiningFeePaise,
      next.checkinEnabled ? 1 : 0,
      next.checkinLat,
      next.checkinLng,
      next.checkinRadiusM,
      next.reminderHour,
      next.batches.join(","),
      gym.id,
    ),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "SETTINGS_EDIT", entity: "gym", entityId: gym.id, before: toGymSettings(gym), after: next }),
  ]);
  // Staff may change settings, the UPI ID included, so the owner hears about every change at once.
  const changed = settingsChanges(toGymSettings(gym), next);
  if (role !== "OWNER" && changed.length) {
    c.executionCtx.waitUntil(
      ownerUserIds(c.env.DB, gym.id).then((ids) =>
        notifyUsers(c.env, ids, { title: changed.includes("UPI ID") ? "UPI ID changed" : "Gym settings changed", body: `${user.name} changed ${changed.join(", ")}.`, url: `/admin/${gym.id}/settings`, tag: `settings-${nowIso()}` }),
      ),
    );
  }
  return c.json({ ok: true });
});

const SETTING_LABELS: Partial<Record<keyof GymSettings, string>> = {
  name: "gym name",
  phone: "desk phone",
  address: "address",
  upiId: "UPI ID",
  graceDays: "grace days",
  joiningFeePaise: "joining fee",
  checkinEnabled: "check-in",
  checkinLat: "check-in location",
  checkinRadiusM: "check-in radius",
  reminderHour: "reminder time",
};

/** The batches the gym runs: at least one, each a known batch, in morning-to-night order. Left out, they stay as they are. */
function readBatches(body: Body, current: Batch[]): Batch[] {
  const picked = body.batches;
  if (picked === undefined) return current;
  if (!Array.isArray(picked) || picked.length === 0 || picked.some((b) => !(BATCHES as readonly unknown[]).includes(b))) throw badInput("batches", "Please pick at least one batch.");
  return BATCHES.filter((b) => picked.includes(b));
}

/** Names of the settings that differ, for the owner's notification. */
function settingsChanges(before: GymSettings, after: Partial<GymSettings>): string[] {
  return (Object.keys(SETTING_LABELS) as (keyof GymSettings)[]).filter((k) => k in after && before[k] !== after[k]).map((k) => SETTING_LABELS[k]!);
}

gymRoutes.get("/plans", async (c) => {
  const { gym } = currentStaff(c);
  const { results } = await c.env.DB.prepare("SELECT * FROM plans WHERE gym_id = ?1 ORDER BY active DESC, kind, price_paise").bind(gym.id).all<PlanRow>();
  return c.json<{ items: Plan[] }>({ items: results.map(toPlan) });
});

function readPlan(body: ReturnType<typeof asBody>) {
  const kind = oneOf(body, "kind", PLAN_KINDS);
  const durationMonths = optionalInt(body, "durationMonths", 1, 36);
  const durationDays = optionalInt(body, "durationDays", 1, 1095);
  if ((durationMonths == null) === (durationDays == null)) throw badInput("durationMonths", "Set the length in months or in days.");
  return {
    kind,
    name: text(body, "name", { max: 60 }),
    durationMonths,
    durationDays,
    pricePaise: int(body, "pricePaise", 0, MAX_AMOUNT_PAISE),
    maxFreezeDays: int(body, "maxFreezeDays", 0, MAX_FREEZE_DAYS),
    trainerCommissionPct: kind === "PT" ? int(body, "trainerCommissionPct", 0, 100) : 0,
  };
}

gymRoutes.post("/plans", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const plan = readPlan(asBody(await c.req.json()));
  const id = newId();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO plans (id, gym_id, kind, name, duration_months, duration_days, price_paise, max_freeze_days, trainer_commission_pct, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    ).bind(id, gym.id, plan.kind, plan.name, plan.durationMonths, plan.durationDays, plan.pricePaise, plan.maxFreezeDays, plan.trainerCommissionPct, nowIso()),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "PLAN_CREATE", entity: "plan", entityId: id, after: plan }),
  ]);
  return c.json({ id }, 201);
});

gymRoutes.patch("/plans/:planId", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const before = await c.env.DB.prepare("SELECT * FROM plans WHERE gym_id = ?1 AND id = ?2").bind(gym.id, c.req.param("planId")).first<PlanRow>();
  if (!before) throw notFound();
  const body = asBody(await c.req.json());
  const plan = readPlan(body);
  const active = bool(body, "active");
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE plans SET kind = ?1, name = ?2, duration_months = ?3, duration_days = ?4, price_paise = ?5, max_freeze_days = ?6, trainer_commission_pct = ?7, active = ?8 WHERE id = ?9`,
    ).bind(plan.kind, plan.name, plan.durationMonths, plan.durationDays, plan.pricePaise, plan.maxFreezeDays, plan.trainerCommissionPct, active ? 1 : 0, before.id),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "PLAN_EDIT", entity: "plan", entityId: before.id, before: toPlan(before), after: { ...plan, active } }),
  ]);
  return c.json({ ok: true });
});

gymRoutes.get("/staff", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const { results } = await c.env.DB.prepare(
    "SELECT st.invite_email, st.role, st.active, st.user_id, u.name FROM gym_staff st LEFT JOIN users u ON u.id = st.user_id WHERE st.gym_id = ?1 ORDER BY st.role DESC, st.invite_email",
  )
    .bind(gym.id)
    .all<{ invite_email: string; role: StaffEntry["role"]; active: number; user_id: string | null; name: string | null }>();
  return c.json<{ items: StaffEntry[] }>({
    items: results.map((r) => ({ email: r.invite_email, userName: r.name, role: r.role, active: r.active === 1, linked: r.user_id != null })),
  });
});

gymRoutes.post("/staff", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const body = asBody(await c.req.json());
  const address = email(body, "email");
  const role = oneOf(body, "role", TEAM_ROLES);
  const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?1").bind(address).first<{ id: string }>();
  const result = await c.env.DB.prepare(
    `INSERT INTO gym_staff (gym_id, invite_email, user_id, role, active, created_by, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)
     ON CONFLICT (gym_id, invite_email) DO NOTHING`,
  )
    .bind(gym.id, address, existingUser?.id ?? null, role, user.id, nowIso())
    .run();
  if (!result.meta.changes) throw new ApiError(409, "This email is already on the staff list.", "email");
  await auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "STAFF_INVITE", entity: "staff", entityId: address, after: { role } }).run();
  return c.json({ ok: true }, 201);
});

gymRoutes.patch("/staff/:email", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const address = decodeURIComponent(c.req.param("email")).toLowerCase();
  const body = asBody(await c.req.json());
  const active = bool(body, "active");
  const role = oneOf(body, "role", TEAM_ROLES);
  const before = await c.env.DB.prepare("SELECT role, active, user_id FROM gym_staff WHERE gym_id = ?1 AND invite_email = ?2").bind(gym.id, address).first<{
    role: string;
    active: number;
    user_id: string | null;
  }>();
  if (!before) throw notFound();
  if (before.role === "OWNER") throw conflict("The gym owner is set when the gym is onboarded. Please contact support to change it.");
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE gym_staff SET active = ?1, role = ?2 WHERE gym_id = ?3 AND invite_email = ?4").bind(active ? 1 : 0, role, gym.id, address),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: active ? "STAFF_EDIT" : "STAFF_REMOVE", entity: "staff", entityId: address, before: { role: before.role, active: before.active === 1 }, after: { role, active } }),
  ]);
  return c.json({ ok: true });
});

gymRoutes.get("/audit", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const before = c.req.query("before") ?? "9999";
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id WHERE a.gym_id = ?1 AND a.at < ?2 ORDER BY a.at DESC LIMIT ?3`,
  )
    .bind(gym.id, before, AUDIT_PAGE)
    .all<{ id: string; action: string; entity: string; entity_id: string; actor_name: string | null; before_json: string | null; after_json: string | null; reason: string | null; at: string }>();
  const items: AuditEntry[] = results.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    actorName: r.actor_name,
    before: r.before_json ? JSON.parse(r.before_json) : null,
    after: r.after_json ? JSON.parse(r.after_json) : null,
    reason: r.reason,
    at: r.at,
  }));
  return c.json({ items, nextBefore: items.length === AUDIT_PAGE ? items[items.length - 1].at : null });
});

function reportRange(gymTimezone: string, from: string | undefined, to: string | undefined) {
  const today = todayIn(gymTimezone);
  const end = to && isIsoDate(to) ? to : today;
  const start = from && isIsoDate(from) ? from : `${end.slice(0, 8)}01`;
  if (start > end || addDays(start, MAX_REPORT_DAYS) < end) throw badInput("from");
  return { start, end };
}

gymRoutes.get("/reports/collections", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const { start, end } = reportRange(gym.timezone, c.req.query("from"), c.req.query("to"));
  const rows = await paymentsBetween(c.env.DB, gym.id, start, end);
  const trainers = new Map<string, { collectedPaise: number; commissionPaise: number }>();
  for (const r of rows) {
    if (r.voided_at || r.kind !== "PT" || !r.trainer_name) continue;
    const t = trainers.get(r.trainer_name) ?? { collectedPaise: 0, commissionPaise: 0 };
    t.collectedPaise += r.amount_paise;
    t.commissionPaise += Math.round((r.amount_paise * r.trainer_commission_pct) / 100);
    trainers.set(r.trainer_name, t);
  }
  return c.json<CollectionsReport>({
    from: start,
    to: end,
    summary: summarizeCollection(rows),
    payments: rows.map(toPayment),
    trainers: [...trainers].map(([trainerName, t]) => ({ trainerName, ...t })),
  });
});

gymRoutes.get("/export/members.csv", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const today = todayIn(gym.timezone);
  const items = (await loadRoster(c.env.DB, gym, today)).map((e) => toListItem(e, today));
  const csv = toCsv(
    ["Name", "Phone", "Status", "State", "Plan", "Ends on", "Dues (Rs)", "Last visit", "Joined via", "Archived"],
    items.map((i) => [i.name, i.phone, i.status, i.state, i.planName ?? "", i.endDate ?? "", (i.duePaise / 100).toFixed(2), i.lastVisit ?? "", i.source, i.archived ? "yes" : ""]),
  );
  return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${gym.slug}-members-${today}.csv"` });
});

gymRoutes.get("/export/payments.csv", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const { start, end } = reportRange(gym.timezone, c.req.query("from"), c.req.query("to"));
  const rows = await paymentsBetween(c.env.DB, gym.id, start, end);
  const csv = toCsv(
    ["Receipt", "Date", "Member", "Plan", "Amount (Rs)", "Mode", "Collected by", "Voided", "Void reason", "Note"],
    rows.map((r) => [String(r.receipt_no), r.paid_on, r.member_name ?? "", r.plan_name, (r.amount_paise / 100).toFixed(2), r.mode, r.collected_by_name ?? "", r.voided_at ? "yes" : "", r.void_reason ?? "", r.note ?? ""]),
  );
  return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${gym.slug}-payments-${start}-to-${end}.csv"` });
});

