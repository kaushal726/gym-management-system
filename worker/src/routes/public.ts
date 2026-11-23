/* What a member does from the gym's QR: see the gym, register, check in, and link a desk-added record. */
import { Hono } from "hono";
import type { CheckinResult, GymEntry, MeMembership } from "../../../shared/api.ts";
import { ageOn, todayIn } from "../../../shared/dates.ts";
import { GENDERS } from "../../../shared/constants.ts";
import type { AppEnv } from "../env.ts";
import { currentUser, requireUser } from "../auth/guards.ts";
import { auditStatement } from "../lib/audit.ts";
import { sha256Hex } from "../lib/crypto.ts";
import { ApiError, MESSAGES, badInput, notFound } from "../lib/http.ts";
import { newId, nowIso } from "../lib/ids.ts";
import { asBody, bool, mobile, optionalDate, optionalMobile, optionalNum, optionalOneOf, optionalText, text } from "../lib/validate.ts";
import { freezesOfMember, getGym, getGymBySlug, paymentsOfMember, standing, subscriptionsOfMember, toStateSummary, visitsOfMember, MEMBER_COLUMNS } from "../db/queries.ts";
import { toMemberProfile, toPublicGym, type GymRow, type MemberRow } from "../db/rows.ts";
import { notifyUsers } from "../push/notify.ts";
import { distanceMeters } from "../lib/geo.ts";

export const publicRoutes = new Hono<AppEnv>();

async function gymOr404(db: D1Database, slug: string): Promise<GymRow> {
  const gym = await getGymBySlug(db, slug);
  if (!gym) throw notFound();
  return gym;
}

async function memberOfUser(db: D1Database, gymId: string, userId: string): Promise<MemberRow | null> {
  return db
    .prepare(`SELECT ${MEMBER_COLUMNS} FROM members m LEFT JOIN users u ON u.id = m.user_id WHERE m.gym_id = ?1 AND m.user_id = ?2 AND m.anonymised_at IS NULL`)
    .bind(gymId, userId)
    .first<MemberRow>();
}

async function staffUserIds(db: D1Database, gymId: string): Promise<string[]> {
  const { results } = await db.prepare("SELECT user_id FROM gym_staff WHERE gym_id = ?1 AND active = 1 AND user_id IS NOT NULL").bind(gymId).all<{ user_id: string }>();
  return results.map((r) => r.user_id);
}

publicRoutes.get("/gyms/:slug", async (c) => {
  const gym = await gymOr404(c.env.DB, c.req.param("slug"));
  const user = c.get("user");
  const member = user ? await memberOfUser(c.env.DB, gym.id, user.id) : null;
  return c.json<GymEntry>({
    gym: toPublicGym(gym),
    member: member ? { id: member.id, status: member.status, requestNo: member.request_no, name: member.name } : null,
  });
});

publicRoutes.post("/gyms/:slug/register", requireUser, async (c) => {
  const user = currentUser(c);
  const gym = await gymOr404(c.env.DB, c.req.param("slug"));
  const body = asBody(await c.req.json());
  if (!bool(body, "consent")) throw badInput("consent", "Please accept the consent to continue.");

  const existing = await memberOfUser(c.env.DB, gym.id, user.id);
  if (existing) return c.json({ ok: true, memberId: existing.id });

  const today = todayIn(gym.timezone);
  const name = text(body, "name", { max: 80 });
  const phone = mobile(body, "phone");
  const dob = optionalDate(body, "dob");
  if (dob && (dob > today || ageOn(dob, today) > 100)) throw badInput("dob");
  const minor = dob != null && ageOn(dob, today) < 18;
  const guardianName = optionalText(body, "guardianName", { max: 80 });
  const guardianPhone = optionalMobile(body, "guardianPhone");
  if (minor && (!guardianName || !guardianPhone)) throw badInput(guardianName ? "guardianPhone" : "guardianName", "A parent or guardian's name and number are needed for members under 18.");

  const phoneTaken = await c.env.DB.prepare("SELECT 1 FROM members WHERE gym_id = ?1 AND phone = ?2").bind(gym.id, phone).first();
  if (phoneTaken) throw new ApiError(409, MESSAGES.duplicatePhone, "phone");

  const id = newId();
  const now = nowIso();
  const row = {
    name,
    phone,
    dob,
    gender: optionalOneOf(body, "gender", GENDERS),
    emergencyName: optionalText(body, "emergencyName", { max: 80 }),
    emergencyPhone: optionalMobile(body, "emergencyPhone"),
    guardianName,
    guardianPhone,
  };
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO members (id, gym_id, user_id, name, phone, dob, gender, emergency_name, emergency_phone, guardian_name, guardian_phone,
         source, status, request_no, consent_at, created_by, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'QR', 'PENDING', (SELECT next_request_no FROM gyms WHERE id = ?2), ?12, ?3, ?12)`,
    ).bind(id, gym.id, user.id, row.name, row.phone, row.dob, row.gender, row.emergencyName, row.emergencyPhone, row.guardianName, row.guardianPhone, now),
    c.env.DB.prepare("UPDATE gyms SET next_request_no = next_request_no + 1 WHERE id = ?1").bind(gym.id),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "MEMBER_REGISTER", entity: "member", entityId: id, after: row }),
  ]);
  c.executionCtx.waitUntil(
    staffUserIds(c.env.DB, gym.id).then((ids) => notifyUsers(c.env, ids, { title: "New joining request", body: `${name} registered and is waiting at the desk.`, url: `/admin/${gym.id}/members/${id}`, tag: `pending-${id}` })),
  );
  return c.json({ ok: true, memberId: id }, 201);
});

publicRoutes.post("/gyms/:slug/checkin", requireUser, async (c) => {
  const user = currentUser(c);
  const gym = await gymOr404(c.env.DB, c.req.param("slug"));
  if (gym.checkin_enabled !== 1) throw new ApiError(403, "Check-in is not turned on at this gym.");
  const member = await memberOfUser(c.env.DB, gym.id, user.id);
  if (!member || member.status !== "JOINED" || member.archived_at) throw new ApiError(403, "Please see the desk to start your membership.");

  const body = asBody(await c.req.json());
  let distance: number | null = null;
  if (gym.checkin_lat != null && gym.checkin_lng != null && gym.checkin_radius_m != null) {
    const lat = optionalNum(body, "lat", -90, 90);
    const lng = optionalNum(body, "lng", -180, 180);
    if (lat == null || lng == null) throw new ApiError(400, "Please allow location so we can confirm you are at the gym.", "location");
    distance = Math.round(distanceMeters(lat, lng, gym.checkin_lat, gym.checkin_lng));
    if (distance > gym.checkin_radius_m) throw new ApiError(403, "You need to be at the gym to check in.", "location");
  }

  const today = todayIn(gym.timezone);
  const subs = await subscriptionsOfMember(c.env.DB, member.id, today);
  const membership = standing(subs, today, gym.grace_days).membership;
  const already = await c.env.DB.prepare("SELECT at FROM attendance WHERE member_id = ?1 AND day = ?2 ORDER BY at LIMIT 1").bind(member.id, today).first<{ at: string }>();
  const at = already?.at ?? nowIso();
  if (!already) {
    await c.env.DB.prepare("INSERT INTO attendance (id, gym_id, member_id, at, day, result, method, distance_m) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'QR', ?7)")
      .bind(newId(), gym.id, member.id, at, today, membership.state, distance)
      .run();
  }
  return c.json<CheckinResult>({
    result: membership.state,
    memberName: member.name,
    pictureUrl: member.picture_url ?? null,
    endDate: membership.chainEnd?.endDate ?? null,
    at,
    alreadyToday: already != null,
  });
});

interface ClaimRow {
  token_hash: string;
  gym_id: string;
  member_id: string;
  expires_at: string;
  used_at: string | null;
  member_name: string;
  gym_name: string;
  gym_slug: string;
}

async function claimOr404(db: D1Database, token: string): Promise<ClaimRow> {
  const row = await db
    .prepare(
      `SELECT ct.*, m.name AS member_name, g.name AS gym_name, g.slug AS gym_slug FROM claim_tokens ct
       JOIN members m ON m.id = ct.member_id JOIN gyms g ON g.id = ct.gym_id WHERE ct.token_hash = ?1`,
    )
    .bind(await sha256Hex(token))
    .first<ClaimRow>();
  if (!row || row.used_at || row.expires_at < nowIso()) throw new ApiError(410, "This link has expired. Please ask the desk for a new one.");
  return row;
}

publicRoutes.get("/claim/:token", async (c) => {
  const claim = await claimOr404(c.env.DB, c.req.param("token"));
  return c.json({ gymName: claim.gym_name, gymSlug: claim.gym_slug, memberName: claim.member_name });
});

publicRoutes.post("/claim/:token", requireUser, async (c) => {
  const user = currentUser(c);
  const claim = await claimOr404(c.env.DB, c.req.param("token"));
  const other = await memberOfUser(c.env.DB, claim.gym_id, user.id);
  if (other && other.id !== claim.member_id && other.status === "JOINED") {
    throw new ApiError(409, "This Google account is already linked to another membership at this gym. Please see the desk.");
  }
  const now = nowIso();
  const statements: D1PreparedStatement[] = [];
  if (other && other.id !== claim.member_id) {
    // A duplicate self-registration from the same person: retire it so the desk record becomes theirs.
    statements.push(
      c.env.DB.prepare("UPDATE members SET user_id = NULL, status = 'REJECTED', rejected_reason = 'Merged into the desk record' WHERE id = ?1").bind(other.id),
      auditStatement(c.env.DB, { gymId: claim.gym_id, actorId: user.id, action: "MEMBER_MERGE", entity: "member", entityId: other.id, after: { mergedInto: claim.member_id } }),
    );
  }
  statements.push(
    c.env.DB.prepare("UPDATE members SET user_id = ?1 WHERE id = ?2").bind(user.id, claim.member_id),
    c.env.DB.prepare("UPDATE claim_tokens SET used_at = ?1 WHERE token_hash = ?2").bind(now, claim.token_hash),
    auditStatement(c.env.DB, { gymId: claim.gym_id, actorId: user.id, action: "MEMBER_LINK", entity: "member", entityId: claim.member_id, after: { email: user.email } }),
  );
  await c.env.DB.batch(statements);
  return c.json({ ok: true, gymId: claim.gym_id });
});

/** The signed-in member's own view of one gym. Read-only. */
publicRoutes.get("/me/gyms/:gymId", requireUser, async (c) => {
  const user = currentUser(c);
  const gym = await getGym(c.env.DB, c.req.param("gymId"));
  if (!gym) throw notFound();
  const member = await memberOfUser(c.env.DB, gym.id, user.id);
  if (!member) throw notFound();
  const today = todayIn(gym.timezone);
  const [subs, payments, freezes, visits] = await Promise.all([
    subscriptionsOfMember(c.env.DB, member.id, today),
    paymentsOfMember(c.env.DB, member.id),
    freezesOfMember(c.env.DB, member.id),
    gym.checkin_enabled === 1 ? visitsOfMember(c.env.DB, member.id) : Promise.resolve([]),
  ]);
  const st = standing(subs, today, gym.grace_days);
  return c.json<MeMembership>({
    today,
    gym: { ...toPublicGym(gym), upiId: gym.upi_id },
    member: toMemberProfile(member),
    membership: toStateSummary(st.membership),
    pt: toStateSummary(st.pt),
    subscriptions: subs.map(({ cancelled: _c, ...s }) => s),
    payments: payments.filter((p) => !p.voidedAt),
    freezes,
    visits,
    duesTotalPaise: st.duePaise,
  });
});
