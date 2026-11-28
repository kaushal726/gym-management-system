/* What a member does from the gym's QR: see the gym, register, check in, and link a desk-added record. */
import { Hono } from "hono";
import type { CheckinResult, GymEntry, MeMembership } from "../../../shared/api.ts";
import { CLAIM_BLOCK_MESSAGE, type ClaimBlock, type ClaimInfo } from "../../../shared/claim.ts";
import { ageOn, todayIn } from "../../../shared/dates.ts";
import { GENDERS, batchChoices, parseBatches } from "../../../shared/constants.ts";
import type { AppEnv } from "../env.ts";
import { currentUser, requireUser } from "../auth/guards.ts";
import { auditStatement } from "../lib/audit.ts";
import { sha256Hex } from "../lib/crypto.ts";
import { ApiError, MESSAGES, badInput, conflict, notFound } from "../lib/http.ts";
import { newId, nowIso } from "../lib/ids.ts";
import { readMemberDetails } from "../lib/memberInput.ts";
import { asBody, bool, mobile, optionalDate, optionalMobile, optionalNum, optionalOneOf, optionalText, text } from "../lib/validate.ts";
import { freezesOfMember, getGym, getGymBySlug, paymentsOfMember, standing, subscriptionsOfMember, toStateSummary, visitsOfMember, MEMBER_COLUMNS } from "../db/queries.ts";
import { toMemberProfile, toPublicGym, type GymRow, type MemberRow } from "../db/rows.ts";
import { notifyUsers } from "../push/notify.ts";
import { distanceMeters } from "../lib/geo.ts";
import { RATE_RULES, enforceRate, networkOf } from "../lib/rateLimit.ts";

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
  await enforceRate(c, RATE_RULES.registerByUser, user.id);
  await enforceRate(c, RATE_RULES.registerByNetwork, networkOf(c));
  const gym = await gymOr404(c.env.DB, c.req.param("slug"));
  const body = asBody(await c.req.json());
  if (!toPublicGym(gym).open) throw new ApiError(403, MESSAGES.gymClosedToPublic, undefined, "GYM_PAUSED");
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

  const emailTaken = await c.env.DB.prepare("SELECT 1 FROM members WHERE gym_id = ?1 AND invite_email = ?2").bind(gym.id, user.email.toLowerCase()).first();
  if (emailTaken) throw new ApiError(409, "This Gmail is already registered at this gym. Please see the desk.", "email");

  const id = newId();
  const now = nowIso();
  const row = {
    name,
    phone,
    dob,
    gender: optionalOneOf(body, "gender", GENDERS),
    batch: optionalOneOf(body, "batch", parseBatches(gym.batches)),
    emergencyName: optionalText(body, "emergencyName", { max: 80 }),
    emergencyPhone: optionalMobile(body, "emergencyPhone"),
    guardianName,
    guardianPhone,
  };
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO members (id, gym_id, user_id, invite_email, name, phone, dob, gender, emergency_name, emergency_phone, guardian_name, guardian_phone,
         source, status, request_no, consent_at, created_by, created_at, batch)
       VALUES (?1, ?2, ?3, ?14, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'QR', 'PENDING', (SELECT next_request_no FROM gyms WHERE id = ?2), ?12, ?3, ?12, ?13)`,
    ).bind(id, gym.id, user.id, row.name, row.phone, row.dob, row.gender, row.emergencyName, row.emergencyPhone, row.guardianName, row.guardianPhone, now, row.batch, user.email.toLowerCase()),
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
  await enforceRate(c, RATE_RULES.checkinByUser, user.id);
  await enforceRate(c, RATE_RULES.checkinByNetwork, networkOf(c));
  const gym = await gymOr404(c.env.DB, c.req.param("slug"));
  if (!toPublicGym(gym).open) throw new ApiError(403, MESSAGES.gymClosedToPublic, undefined, "GYM_PAUSED");
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
  member_invite_email: string | null;
  member_user_id: string | null;
  gym_name: string;
  gym_slug: string;
}

const CLAIM_EXPIRED = "This link has expired. Please ask the desk for a new one.";

async function claimOr404(db: D1Database, token: string): Promise<ClaimRow> {
  const row = await db
    .prepare(
      `SELECT ct.*, m.name AS member_name, m.invite_email AS member_invite_email, m.user_id AS member_user_id, g.name AS gym_name, g.slug AS gym_slug FROM claim_tokens ct
       JOIN members m ON m.id = ct.member_id JOIN gyms g ON g.id = ct.gym_id WHERE ct.token_hash = ?1 AND m.anonymised_at IS NULL`,
    )
    .bind(await sha256Hex(token))
    .first<ClaimRow>();
  if (!row || row.used_at || row.expires_at < nowIso()) throw new ApiError(410, CLAIM_EXPIRED);
  return row;
}

/** Gym staff can't take a member's link, and a member added with a Gmail can only be linked by that Gmail. */
async function claimBlock(db: D1Database, claim: ClaimRow, user: { id: string; email: string }): Promise<ClaimBlock | null> {
  const staff = await db.prepare("SELECT 1 FROM gym_staff WHERE gym_id = ?1 AND user_id = ?2 AND active = 1").bind(claim.gym_id, user.id).first();
  if (staff) return "STAFF";
  if (claim.member_user_id && claim.member_user_id !== user.id) return "ALREADY_LINKED";
  if (claim.member_invite_email && claim.member_invite_email !== user.email.toLowerCase()) return "OTHER_EMAIL";
  return null;
}

publicRoutes.get("/claim/:token", async (c) => {
  const claim = await claimOr404(c.env.DB, c.req.param("token"));
  const user = c.get("user");
  return c.json<ClaimInfo>({ gymName: claim.gym_name, gymSlug: claim.gym_slug, memberName: claim.member_name, blocked: user ? await claimBlock(c.env.DB, claim, user) : null });
});

publicRoutes.post("/claim/:token", requireUser, async (c) => {
  const user = currentUser(c);
  await enforceRate(c, RATE_RULES.claimByNetwork, networkOf(c));
  const claim = await claimOr404(c.env.DB, c.req.param("token"));
  const blocked = await claimBlock(c.env.DB, claim, user);
  if (blocked) throw new ApiError(403, CLAIM_BLOCK_MESSAGE[blocked], undefined, `CLAIM_${blocked}`);
  const other = await memberOfUser(c.env.DB, claim.gym_id, user.id);
  if (other && other.id !== claim.member_id && other.status === "JOINED") {
    throw new ApiError(409, "This Google account is already linked to another membership at this gym. Please see the desk.");
  }
  const now = nowIso();
  // Use the link up first, in one conditional write, so two people opening it at once can't both link.
  const consumed = await c.env.DB.prepare("UPDATE claim_tokens SET used_at = ?1 WHERE token_hash = ?2 AND used_at IS NULL AND expires_at > ?1").bind(now, claim.token_hash).run();
  if (consumed.meta.changes !== 1) throw new ApiError(410, CLAIM_EXPIRED);
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
    auditStatement(c.env.DB, { gymId: claim.gym_id, actorId: user.id, action: "MEMBER_LINK", entity: "member", entityId: claim.member_id, after: { email: user.email } }),
  );
  await c.env.DB.batch(statements);
  return c.json({ ok: true, gymId: claim.gym_id });
});

/** A member changes their own basic details (everything but the Gmail). A new phone number is kept in history and audited. */
publicRoutes.patch("/me/gyms/:gymId", requireUser, async (c) => {
  const user = currentUser(c);
  const gym = await getGym(c.env.DB, c.req.param("gymId"));
  if (!gym) throw notFound();
  const member = await memberOfUser(c.env.DB, gym.id, user.id);
  if (!member) throw notFound();
  if (member.status === "REJECTED" || member.archived_at) throw conflict("Please see the desk to change your details.");
  const input = readMemberDetails(asBody(await c.req.json()), todayIn(gym.timezone), batchChoices(parseBatches(gym.batches), member.batch));
  const phoneChanged = input.phone !== member.phone;
  const statements: D1PreparedStatement[] = [];
  if (phoneChanged) {
    const taken = await c.env.DB.prepare("SELECT 1 FROM members WHERE gym_id = ?1 AND phone = ?2 AND id <> ?3").bind(gym.id, input.phone, member.id).first();
    if (taken) throw new ApiError(409, MESSAGES.duplicatePhone, "phone");
    statements.push(
      c.env.DB.prepare("INSERT INTO member_phone_history (id, gym_id, member_id, old_phone, new_phone, changed_by, changed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)").bind(newId(), gym.id, member.id, member.phone, input.phone, user.id, nowIso()),
    );
  }
  const before = toMemberProfile(member);
  statements.push(
    c.env.DB.prepare(
      `UPDATE members SET name = ?1, phone = ?2, dob = ?3, gender = ?4, emergency_name = ?5, emergency_phone = ?6, guardian_name = ?7, guardian_phone = ?8, batch = ?9
       WHERE id = ?10 AND user_id = ?11`,
    ).bind(input.name, input.phone, input.dob, input.gender, input.emergencyName, input.emergencyPhone, input.guardianName, input.guardianPhone, input.batch, member.id, user.id),
    auditStatement(c.env.DB, {
      gymId: gym.id,
      actorId: user.id,
      action: phoneChanged ? "MEMBER_PHONE_EDIT" : "MEMBER_SELF_EDIT",
      entity: "member",
      entityId: member.id,
      before: { name: before.name, phone: before.phone, dob: before.dob, gender: before.gender, batch: before.batch, emergencyName: before.emergencyName, emergencyPhone: before.emergencyPhone, guardianName: before.guardianName, guardianPhone: before.guardianPhone },
      after: input,
      reason: "Changed by the member",
    }),
  );
  await c.env.DB.batch(statements);
  return c.json({ ok: true });
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
