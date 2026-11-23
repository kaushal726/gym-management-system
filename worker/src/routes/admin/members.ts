/* Desk work on members: list, add, edit, reject, archive, link to Google, check in by hand. */
import { Hono } from "hono";
import type { ClaimLink, MemberDetail, MemberFilter, MemberListItem } from "../../../../shared/api.ts";
import { MEMBER_FILTERS } from "../../../../shared/api.ts";
import { CLAIM_LINK_DAYS, GENDERS } from "../../../../shared/constants.ts";
import { ageOn, todayIn } from "../../../../shared/dates.ts";
import { matchesFilter, matchesSearch } from "../../../../shared/filters.ts";
import { nextStartDate } from "../../../../shared/membership.ts";
import type { AppEnv } from "../../env.ts";
import { currentStaff, currentUser, ownerOnly } from "../../auth/guards.ts";
import { auditStatement } from "../../lib/audit.ts";
import { randomToken, sha256Hex } from "../../lib/crypto.ts";
import { ApiError, badInput, conflict, notFound } from "../../lib/http.ts";
import { newId, nowIso } from "../../lib/ids.ts";
import { asBody, mobile, optionalDate, optionalEmail, optionalMobile, optionalOneOf, optionalText, text, type Body } from "../../lib/validate.ts";
import { freezesOfMember, getMember, loadRoster, paymentsOfMember, standing, subscriptionsOfMember, toListItem, toStateSummary, visitsOfMember } from "../../db/queries.ts";
import { toMemberProfile, type MemberRow } from "../../db/rows.ts";

export const memberRoutes = new Hono<AppEnv>();

const DAY_MS = 86_400_000;
/** Offline check-ins recorded on the desk phone are accepted when synced up to this many days later. */
const OFFLINE_CHECKIN_MAX_DAYS = 7;

async function memberOr404(db: D1Database, gymId: string, memberId: string): Promise<MemberRow> {
  const member = await getMember(db, gymId, memberId);
  if (!member || member.anonymised_at) throw notFound();
  return member;
}

function readMemberInput(body: Body, today: string) {
  const dob = optionalDate(body, "dob");
  if (dob && (dob > today || ageOn(dob, today) > 100)) throw badInput("dob");
  const guardianName = optionalText(body, "guardianName", { max: 80 });
  const guardianPhone = optionalMobile(body, "guardianPhone");
  if (dob && ageOn(dob, today) < 18 && (!guardianName || !guardianPhone)) {
    throw badInput(guardianName ? "guardianPhone" : "guardianName", "A parent or guardian's name and number are needed for members under 18.");
  }
  return {
    name: text(body, "name", { max: 80 }),
    phone: mobile(body, "phone"),
    dob,
    gender: optionalOneOf(body, "gender", GENDERS),
    emergencyName: optionalText(body, "emergencyName", { max: 80 }),
    emergencyPhone: optionalMobile(body, "emergencyPhone"),
    guardianName,
    guardianPhone,
    email: optionalEmail(body, "email"),
  };
}

const EMAIL_TAKEN = "This email is already used by another member at this gym.";

/** One email per gym: no other member here was added with it or signs in with it. */
async function assertEmailFree(db: D1Database, gymId: string, address: string, exceptMemberId: string | null): Promise<void> {
  const taken = await db
    .prepare(
      `SELECT 1 FROM members m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.gym_id = ?1 AND m.anonymised_at IS NULL AND (?3 IS NULL OR m.id <> ?3) AND (m.invite_email = ?2 OR lower(u.email) = ?2)`,
    )
    .bind(gymId, address, exceptMemberId)
    .first();
  if (taken) throw new ApiError(409, EMAIL_TAKEN, "email");
}

/** The account that already signed in with this email, if any, so the member is linked straight away. */
async function userIdForEmail(db: D1Database, address: string | null): Promise<string | null> {
  if (!address) return null;
  const row = await db.prepare("SELECT id FROM users WHERE lower(email) = ?1").bind(address).first<{ id: string }>();
  return row?.id ?? null;
}

memberRoutes.get("/members", async (c) => {
  const { gym } = currentStaff(c);
  const today = todayIn(gym.timezone);
  const filterParam = c.req.query("filter") ?? "all";
  const filter: MemberFilter = (MEMBER_FILTERS as readonly string[]).includes(filterParam) ? (filterParam as MemberFilter) : "all";
  const query = c.req.query("q") ?? "";
  const items = (await loadRoster(c.env.DB, gym, today)).map((e) => toListItem(e, today));
  const counts = Object.fromEntries(MEMBER_FILTERS.map((f) => [f, items.filter((i) => matchesFilter(i, f)).length])) as Record<MemberFilter, number>;
  const list = items.filter((i) => matchesFilter(i, filter) && matchesSearch(i, query));
  return c.json<{ items: MemberListItem[]; counts: Record<MemberFilter, number> }>({ items: list, counts });
});

memberRoutes.post("/members", async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const input = readMemberInput(asBody(await c.req.json()), todayIn(gym.timezone));
  const taken = await c.env.DB.prepare("SELECT 1 FROM members WHERE gym_id = ?1 AND phone = ?2").bind(gym.id, input.phone).first();
  if (taken) throw new ApiError(409, "This phone number is already registered at this gym.", "phone");
  if (input.email) await assertEmailFree(c.env.DB, gym.id, input.email, null);
  const linkUserId = await userIdForEmail(c.env.DB, input.email);
  const id = newId();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO members (id, gym_id, user_id, invite_email, name, phone, dob, gender, emergency_name, emergency_phone, guardian_name, guardian_phone, source, status, created_by, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'DESK', 'PENDING', ?13, ?14)`,
    ).bind(id, gym.id, linkUserId, input.email, input.name, input.phone, input.dob, input.gender, input.emergencyName, input.emergencyPhone, input.guardianName, input.guardianPhone, user.id, nowIso()),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "MEMBER_ADD", entity: "member", entityId: id, after: input }),
  ]);
  return c.json({ id }, 201);
});

memberRoutes.get("/members/:memberId", async (c) => {
  const { gym } = currentStaff(c);
  const member = await memberOr404(c.env.DB, gym.id, c.req.param("memberId"));
  const today = todayIn(gym.timezone);
  const [subs, payments, freezes, visits, history] = await Promise.all([
    subscriptionsOfMember(c.env.DB, member.id, today),
    paymentsOfMember(c.env.DB, member.id),
    freezesOfMember(c.env.DB, member.id),
    visitsOfMember(c.env.DB, member.id),
    c.env.DB.prepare(
      `SELECT h.old_phone, h.new_phone, h.changed_at, u.name AS changed_by_name FROM member_phone_history h LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.member_id = ?1 ORDER BY h.changed_at DESC`,
    )
      .bind(member.id)
      .all<{ old_phone: string; new_phone: string; changed_at: string; changed_by_name: string | null }>(),
  ]);
  const st = standing(subs, today, gym.grace_days);
  const membershipSubs = subs.filter((s) => s.kind === "MEMBERSHIP");
  return c.json<MemberDetail>({
    today,
    graceDays: gym.grace_days,
    member: toMemberProfile(member),
    membership: toStateSummary(st.membership),
    pt: toStateSummary(st.pt),
    subscriptions: subs.map(({ cancelled: _c, ...s }) => s),
    payments,
    freezes,
    visits,
    phoneHistory: history.results.map((h) => ({ oldPhone: h.old_phone, newPhone: h.new_phone, changedAt: h.changed_at, changedByName: h.changed_by_name })),
    nextStartDate: nextStartDate(membershipSubs, today),
    nextPtStartDate: nextStartDate(
      subs.filter((s) => s.kind === "PT"),
      today,
    ),
    isFirstSubscription: membershipSubs.length === 0,
    duesTotalPaise: st.duePaise,
  });
});

memberRoutes.patch("/members/:memberId", async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const member = await memberOr404(c.env.DB, gym.id, c.req.param("memberId"));
  const input = readMemberInput(asBody(await c.req.json()), todayIn(gym.timezone));
  const statements: D1PreparedStatement[] = [];
  if (input.phone !== member.phone) {
    const taken = await c.env.DB.prepare("SELECT 1 FROM members WHERE gym_id = ?1 AND phone = ?2 AND id <> ?3").bind(gym.id, input.phone, member.id).first();
    if (taken) throw new ApiError(409, "This phone number is already registered at this gym.", "phone");
    statements.push(
      c.env.DB.prepare("INSERT INTO member_phone_history (id, gym_id, member_id, old_phone, new_phone, changed_by, changed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)").bind(
        newId(),
        gym.id,
        member.id,
        member.phone,
        input.phone,
        user.id,
        nowIso(),
      ),
    );
  }
  if (input.email && input.email !== member.invite_email) await assertEmailFree(c.env.DB, gym.id, input.email, member.id);
  // A member already linked to a Google account keeps that link; otherwise link now if this email has signed in before.
  const linkUserId = member.user_id ?? (await userIdForEmail(c.env.DB, input.email));
  const before = toMemberProfile(member);
  statements.push(
    c.env.DB.prepare(
      `UPDATE members SET name = ?1, phone = ?2, dob = ?3, gender = ?4, emergency_name = ?5, emergency_phone = ?6, guardian_name = ?7, guardian_phone = ?8,
         invite_email = ?9, user_id = ?10 WHERE id = ?11`,
    ).bind(input.name, input.phone, input.dob, input.gender, input.emergencyName, input.emergencyPhone, input.guardianName, input.guardianPhone, input.email, linkUserId, member.id),
    auditStatement(c.env.DB, {
      gymId: gym.id,
      actorId: user.id,
      action: input.phone !== member.phone ? "MEMBER_PHONE_EDIT" : "MEMBER_EDIT",
      entity: "member",
      entityId: member.id,
      before: { name: before.name, phone: before.phone, dob: before.dob, gender: before.gender, emergencyName: before.emergencyName, emergencyPhone: before.emergencyPhone, guardianName: before.guardianName, guardianPhone: before.guardianPhone, email: before.inviteEmail },
      after: input,
    }),
  );
  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});

memberRoutes.post("/members/:memberId/reject", async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const member = await memberOr404(c.env.DB, gym.id, c.req.param("memberId"));
  if (member.status !== "PENDING" && member.status !== "LEAD") throw conflict("Only a pending request can be rejected.");
  const reason = text(asBody(await c.req.json()), "reason", { max: 200 });
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE members SET status = 'REJECTED', rejected_reason = ?1 WHERE id = ?2").bind(reason, member.id),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "MEMBER_REJECT", entity: "member", entityId: member.id, before: { status: member.status }, after: { status: "REJECTED" }, reason }),
  ]);
  return c.json({ ok: true });
});

memberRoutes.post("/members/:memberId/archive", async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const member = await memberOr404(c.env.DB, gym.id, c.req.param("memberId"));
  const reason = text(asBody(await c.req.json()), "reason", { max: 200 });
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE members SET archived_at = ?1, archived_reason = ?2 WHERE id = ?3").bind(nowIso(), reason, member.id),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "MEMBER_ARCHIVE", entity: "member", entityId: member.id, reason }),
  ]);
  return c.json({ ok: true });
});

memberRoutes.post("/members/:memberId/unarchive", async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const member = await memberOr404(c.env.DB, gym.id, c.req.param("memberId"));
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE members SET archived_at = NULL, archived_reason = NULL WHERE id = ?1").bind(member.id),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "MEMBER_UNARCHIVE", entity: "member", entityId: member.id }),
  ]);
  return c.json({ ok: true });
});

/** Data deletion request (DPDP): personal details are wiped, payment rows stay for the accounts. */
memberRoutes.post("/members/:memberId/anonymise", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const member = await memberOr404(c.env.DB, gym.id, c.req.param("memberId"));
  const reason = text(asBody(await c.req.json()), "reason", { max: 200 });
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE members SET name = 'Deleted member', phone = 'deleted-' || id, dob = NULL, gender = NULL, emergency_name = NULL, emergency_phone = NULL,
         guardian_name = NULL, guardian_phone = NULL, user_id = NULL, invite_email = NULL, anonymised_at = ?1 WHERE id = ?2`,
    ).bind(nowIso(), member.id),
    c.env.DB.prepare("DELETE FROM followups WHERE member_id = ?1 AND contacted_at IS NULL").bind(member.id),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "MEMBER_ANONYMISE", entity: "member", entityId: member.id, reason }),
  ]);
  return c.json({ ok: true });
});

memberRoutes.post("/members/:memberId/claim-link", async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const member = await memberOr404(c.env.DB, gym.id, c.req.param("memberId"));
  const token = randomToken();
  const expiresAt = new Date(Date.now() + CLAIM_LINK_DAYS * DAY_MS).toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE claim_tokens SET used_at = ?1 WHERE member_id = ?2 AND used_at IS NULL").bind(nowIso(), member.id),
    c.env.DB.prepare("INSERT INTO claim_tokens (token_hash, gym_id, member_id, created_by, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(
      await sha256Hex(token),
      gym.id,
      member.id,
      user.id,
      nowIso(),
      expiresAt,
    ),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "MEMBER_LINK_SENT", entity: "member", entityId: member.id }),
  ]);
  const url = `${new URL(c.req.url).origin}/claim/${token}`;
  const first = member.name.split(" ")[0];
  return c.json<ClaimLink>({
    url,
    expiresAt,
    whatsappText: `Hi ${first}, open this link and sign in with Google to see your ${gym.name} membership, dues and receipts on your phone: ${url}`,
  });
});

/** Check-in marked at the desk. `at` is set when the desk phone recorded it offline and is syncing now. */
memberRoutes.post("/members/:memberId/checkin", async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const member = await memberOr404(c.env.DB, gym.id, c.req.param("memberId"));
  if (member.status !== "JOINED") throw conflict("Only members with a plan can be checked in.");
  const body = asBody(await c.req.json());
  const atText = optionalText(body, "at", { max: 40 });
  let at = nowIso();
  if (atText) {
    const parsed = Date.parse(atText);
    if (Number.isNaN(parsed) || parsed > Date.now() + 60_000 || parsed < Date.now() - OFFLINE_CHECKIN_MAX_DAYS * DAY_MS) throw badInput("at");
    at = new Date(parsed).toISOString();
  }
  const day = todayIn(gym.timezone, new Date(at));
  const subs = await subscriptionsOfMember(c.env.DB, member.id, day);
  const state = standing(subs, day, gym.grace_days).membership.state;
  const already = await c.env.DB.prepare("SELECT 1 FROM attendance WHERE member_id = ?1 AND day = ?2").bind(member.id, day).first();
  if (!already) {
    await c.env.DB.prepare("INSERT INTO attendance (id, gym_id, member_id, at, day, result, method, recorded_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
      .bind(newId(), gym.id, member.id, at, day, state, atText ? "OFFLINE" : "DESK", user.id)
      .run();
  }
  return c.json({ ok: true, result: state, alreadyToday: already != null });
});

memberRoutes.get("/checkins", async (c) => {
  const { gym } = currentStaff(c);
  const day = c.req.query("day") ?? todayIn(gym.timezone);
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.at, a.result, a.method, m.id AS member_id, m.name, m.phone, u.picture_url FROM attendance a
     JOIN members m ON m.id = a.member_id LEFT JOIN users u ON u.id = m.user_id WHERE a.gym_id = ?1 AND a.day = ?2 ORDER BY a.at DESC LIMIT 300`,
  )
    .bind(gym.id, day)
    .all<{ id: string; at: string; result: MemberDetail["membership"]["state"]; method: "QR" | "DESK" | "OFFLINE"; member_id: string; name: string; phone: string; picture_url: string | null }>();
  return c.json({
    day,
    items: results.map((r) => ({ id: r.id, at: r.at, result: r.result, method: r.method, member: { id: r.member_id, name: r.name, phone: r.phone, pictureUrl: r.picture_url } })),
  });
});

