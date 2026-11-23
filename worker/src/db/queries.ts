/* Shared reads. Each one is a single query per gym or per member: nothing here queries inside a loop. */
import type { MemberListItem, StateSummary, Subscription } from "../../../shared/api.ts";
import { daysBetween, type IsoDate } from "../../../shared/dates.ts";
import { summarize, type MembershipSummary } from "../../../shared/membership.ts";
import { toFreeze, toPayment, toSubscription, toVisit, type FreezeRow, type GymRow, type MemberRow, type PaymentRow, type SubscriptionRow } from "./rows.ts";

/** `?1` is always "today" in the gym's time zone. */
const SUBSCRIPTION_COLUMNS = `
  s.*,
  COALESCE((SELECT SUM(p.amount_paise) FROM payments p WHERE p.subscription_id = s.id AND p.voided_at IS NULL), 0) AS paid_paise,
  EXISTS (SELECT 1 FROM freezes f WHERE f.subscription_id = s.id AND ?1 BETWEEN f.from_date AND f.to_date) AS frozen_today,
  CAST(COALESCE((SELECT SUM(julianday(f.to_date) - julianday(f.from_date) + 1) FROM freezes f WHERE f.subscription_id = s.id), 0) AS INTEGER) AS freeze_days_used,
  cu.name AS created_by_name`;

const PAYMENT_COLUMNS = `p.*, s.plan_name, u.name AS collected_by_name`;

export const MEMBER_COLUMNS = `m.*, u.picture_url, u.email AS linked_email`;

export type SubFlagged = Subscription & { cancelled: boolean };

function flag(s: Subscription): SubFlagged {
  return { ...s, cancelled: s.cancelledAt != null };
}

export async function getGym(db: D1Database, gymId: string): Promise<GymRow | null> {
  return db.prepare("SELECT * FROM gyms WHERE id = ?1").bind(gymId).first<GymRow>();
}

export async function getGymBySlug(db: D1Database, slug: string): Promise<GymRow | null> {
  return db.prepare("SELECT * FROM gyms WHERE slug = ?1").bind(slug).first<GymRow>();
}

export async function getMember(db: D1Database, gymId: string, memberId: string): Promise<MemberRow | null> {
  return db
    .prepare(`SELECT ${MEMBER_COLUMNS} FROM members m LEFT JOIN users u ON u.id = m.user_id WHERE m.gym_id = ?1 AND m.id = ?2`)
    .bind(gymId, memberId)
    .first<MemberRow>();
}

export async function subscriptionsOfMember(db: D1Database, memberId: string, today: IsoDate): Promise<SubFlagged[]> {
  const { results } = await db
    .prepare(`SELECT ${SUBSCRIPTION_COLUMNS} FROM subscriptions s LEFT JOIN users cu ON cu.id = s.created_by WHERE s.member_id = ?2 ORDER BY s.start_date DESC, s.created_at DESC`)
    .bind(today, memberId)
    .all<SubscriptionRow>();
  return results.map((r) => flag(toSubscription(r)));
}

export async function getSubscription(db: D1Database, gymId: string, subscriptionId: string, today: IsoDate): Promise<SubFlagged | null> {
  const row = await db
    .prepare(`SELECT ${SUBSCRIPTION_COLUMNS} FROM subscriptions s LEFT JOIN users cu ON cu.id = s.created_by WHERE s.gym_id = ?2 AND s.id = ?3`)
    .bind(today, gymId, subscriptionId)
    .first<SubscriptionRow>();
  return row ? flag(toSubscription(row)) : null;
}

export async function paymentsOfMember(db: D1Database, memberId: string) {
  const { results } = await db
    .prepare(
      `SELECT ${PAYMENT_COLUMNS} FROM payments p JOIN subscriptions s ON s.id = p.subscription_id LEFT JOIN users u ON u.id = p.collected_by
       WHERE p.member_id = ?1 ORDER BY p.created_at DESC`,
    )
    .bind(memberId)
    .all<PaymentRow>();
  return results.map(toPayment);
}

export async function paymentRowsOfSubscription(db: D1Database, subscriptionId: string) {
  const { results } = await db
    .prepare(`SELECT ${PAYMENT_COLUMNS} FROM payments p JOIN subscriptions s ON s.id = p.subscription_id LEFT JOIN users u ON u.id = p.collected_by WHERE p.subscription_id = ?1`)
    .bind(subscriptionId)
    .all<PaymentRow>();
  return results.map(toPayment);
}

export async function paymentsBetween(db: D1Database, gymId: string, from: IsoDate, to: IsoDate) {
  const { results } = await db
    .prepare(
      `SELECT ${PAYMENT_COLUMNS}, m.name AS member_name, s.trainer_name, s.trainer_commission_pct, s.kind
       FROM payments p JOIN subscriptions s ON s.id = p.subscription_id JOIN members m ON m.id = p.member_id LEFT JOIN users u ON u.id = p.collected_by
       WHERE p.gym_id = ?1 AND p.paid_on BETWEEN ?2 AND ?3 ORDER BY p.created_at DESC`,
    )
    .bind(gymId, from, to)
    .all<PaymentRow & { trainer_name: string | null; trainer_commission_pct: number; kind: string }>();
  return results;
}

export async function freezesOfMember(db: D1Database, memberId: string) {
  const { results } = await db
    .prepare(
      `SELECT f.*, u.name AS created_by_name FROM freezes f JOIN subscriptions s ON s.id = f.subscription_id LEFT JOIN users u ON u.id = f.created_by
       WHERE s.member_id = ?1 ORDER BY f.from_date DESC`,
    )
    .bind(memberId)
    .all<FreezeRow>();
  return results.map(toFreeze);
}

export async function visitsOfMember(db: D1Database, memberId: string, limit = 60) {
  const { results } = await db.prepare("SELECT id, at, day, result, method FROM attendance WHERE member_id = ?1 ORDER BY at DESC LIMIT ?2").bind(memberId, limit).all<Parameters<typeof toVisit>[0]>();
  return results.map(toVisit);
}

export interface MemberStanding {
  membership: MembershipSummary<SubFlagged>;
  pt: MembershipSummary<SubFlagged>;
  duePaise: number;
}

export function standing(subs: readonly SubFlagged[], today: IsoDate, graceDays: number): MemberStanding {
  return {
    membership: summarize(
      subs.filter((s) => s.kind === "MEMBERSHIP"),
      today,
      graceDays,
    ),
    pt: summarize(
      subs.filter((s) => s.kind === "PT"),
      today,
      0,
    ),
    duePaise: subs.reduce((sum, s) => sum + s.duePaise, 0),
  };
}

export function toStateSummary(summary: MembershipSummary<SubFlagged>): StateSummary {
  const strip = (s: SubFlagged | null): Subscription | null => {
    if (!s) return null;
    const { cancelled: _cancelled, ...rest } = s;
    return rest;
  };
  return { state: summary.state, daysLeft: summary.daysLeft, daysSinceEnd: summary.daysSinceEnd, current: strip(summary.current), upcoming: strip(summary.upcoming) };
}

export interface RosterEntry {
  member: MemberRow;
  subs: SubFlagged[];
  standing: MemberStanding;
  lastVisit: IsoDate | null;
}

/** Every member of a gym with their subscriptions and dues: three queries in one batch, grouped in memory. */
export async function loadRoster(db: D1Database, gym: GymRow, today: IsoDate): Promise<RosterEntry[]> {
  const [members, subs, visits] = await db.batch([
    db.prepare(`SELECT ${MEMBER_COLUMNS} FROM members m LEFT JOIN users u ON u.id = m.user_id WHERE m.gym_id = ?1 AND m.anonymised_at IS NULL ORDER BY m.created_at DESC`).bind(gym.id),
    db.prepare(`SELECT ${SUBSCRIPTION_COLUMNS} FROM subscriptions s LEFT JOIN users cu ON cu.id = s.created_by WHERE s.gym_id = ?2 AND s.cancelled_at IS NULL`).bind(today, gym.id),
    db.prepare("SELECT member_id, MAX(day) AS last_day FROM attendance WHERE gym_id = ?1 GROUP BY member_id").bind(gym.id),
  ]);
  const byMember = new Map<string, SubFlagged[]>();
  for (const row of subs.results as unknown as SubscriptionRow[]) {
    const list = byMember.get(row.member_id) ?? [];
    list.push(flag(toSubscription(row)));
    byMember.set(row.member_id, list);
  }
  const lastVisit = new Map((visits.results as { member_id: string; last_day: string }[]).map((v) => [v.member_id, v.last_day]));
  return (members.results as unknown as MemberRow[]).map((member) => {
    const memberSubs = byMember.get(member.id) ?? [];
    return { member, subs: memberSubs, standing: standing(memberSubs, today, gym.grace_days), lastVisit: lastVisit.get(member.id) ?? null };
  });
}

export function toListItem(entry: RosterEntry, today: IsoDate): MemberListItem {
  const { member, standing: st } = entry;
  const current = st.membership.current;
  const chainEnd = st.membership.chainEnd;
  const covered = st.membership.state === "ACTIVE" || st.membership.state === "FROZEN";
  return {
    id: member.id,
    name: member.name,
    phone: member.phone,
    pictureUrl: member.picture_url ?? null,
    status: member.status,
    source: member.source,
    requestNo: member.request_no,
    archived: member.archived_at != null,
    createdAt: member.created_at,
    linked: member.user_id != null,
    state: st.membership.state,
    planName: current?.planName ?? st.membership.upcoming?.planName ?? null,
    endDate: chainEnd?.endDate ?? null,
    daysLeft: covered && chainEnd ? daysBetween(today, chainEnd.endDate) : null,
    daysSinceEnd: st.membership.daysSinceEnd,
    hasUpcoming: st.membership.upcoming != null,
    duePaise: st.duePaise,
    ptActive: st.pt.state === "ACTIVE" || st.pt.state === "FROZEN",
    lastVisit: entry.lastVisit,
  };
}
