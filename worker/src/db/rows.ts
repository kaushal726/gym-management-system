/* Database row shapes and their mapping to API types. SQL uses snake_case, the API camelCase. */
import type { Freeze, GymSettings, MemberProfile, Payment, Plan, PublicGym, Subscription, Visit } from "../../../shared/api.ts";
import type { Batch, Gender, MemberStatus, PaymentMode, PlanKind, StaffRole } from "../../../shared/constants.ts";
import type { MembershipState } from "../../../shared/membership.ts";
import { gymAccess, gymIsOpen, type GymStatus } from "../../../shared/saas.ts";
import { todayIn } from "../../../shared/dates.ts";

export interface GymRow {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  upi_id: string | null;
  grace_days: number;
  joining_fee_paise: number;
  checkin_enabled: number;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkin_radius_m: number | null;
  reminder_hour: number;
  next_receipt_no: number;
  next_request_no: number;
  status: GymStatus;
  status_reason: string | null;
  status_changed_at: string | null;
  saas_plan_name: string | null;
  valid_till: string | null;
  created_at: string;
}

export interface MemberRow {
  id: string;
  gym_id: string;
  user_id: string | null;
  name: string;
  phone: string;
  dob: string | null;
  gender: Gender | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  source: "QR" | "DESK";
  status: MemberStatus;
  request_no: number | null;
  rejected_reason: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  consent_at: string | null;
  anonymised_at: string | null;
  created_at: string;
  invite_email: string | null;
  batch: Batch | null;
  /** Joined from users when selected. */
  picture_url?: string | null;
  linked_email?: string | null;
}

export interface PlanRow {
  id: string;
  gym_id: string;
  kind: PlanKind;
  name: string;
  duration_months: number | null;
  duration_days: number | null;
  price_paise: number;
  max_freeze_days: number;
  trainer_commission_pct: number;
  active: number;
}

export interface SubscriptionRow {
  id: string;
  gym_id: string;
  member_id: string;
  plan_id: string | null;
  kind: PlanKind;
  plan_name: string;
  duration_months: number | null;
  duration_days: number | null;
  max_freeze_days: number;
  trainer_name: string | null;
  trainer_commission_pct: number;
  start_date: string;
  end_date: string;
  list_price_paise: number;
  final_price_paise: number;
  discount_reason: string | null;
  joining_fee_paise: number;
  backdate_reason: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  /** Computed columns, present in the queries in this module. */
  paid_paise: number;
  frozen_today: number;
  freeze_days_used: number;
  created_by_name?: string | null;
}

export interface PaymentRow {
  id: string;
  gym_id: string;
  subscription_id: string;
  member_id: string;
  amount_paise: number;
  mode: PaymentMode;
  paid_on: string;
  receipt_no: number;
  collected_by: string;
  note: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  plan_name: string;
  collected_by_name: string | null;
  member_name?: string;
}

export interface FreezeRow {
  id: string;
  subscription_id: string;
  from_date: string;
  to_date: string;
  reason: string;
  created_by_name: string | null;
  created_at: string;
}

export interface StaffRow {
  gym_id: string;
  invite_email: string;
  user_id: string | null;
  role: StaffRole;
  active: number;
}

/** The gym's platform access today, in its own time zone. */
export function accessOf(g: Pick<GymRow, "status" | "valid_till" | "timezone">) {
  return gymAccess({ status: g.status, validTill: g.valid_till }, todayIn(g.timezone));
}

export function toPublicGym(g: GymRow): PublicGym {
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    phone: g.phone,
    address: g.address,
    checkinEnabled: g.checkin_enabled === 1,
    checkinNeedsLocation: g.checkin_lat != null && g.checkin_lng != null && g.checkin_radius_m != null,
    open: gymIsOpen(accessOf(g)),
  };
}

export function toGymSettings(g: GymRow): GymSettings {
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    phone: g.phone,
    address: g.address,
    timezone: g.timezone,
    upiId: g.upi_id,
    graceDays: g.grace_days,
    joiningFeePaise: g.joining_fee_paise,
    checkinEnabled: g.checkin_enabled === 1,
    checkinLat: g.checkin_lat,
    checkinLng: g.checkin_lng,
    checkinRadiusM: g.checkin_radius_m,
    reminderHour: g.reminder_hour,
  };
}

export function toPlan(p: PlanRow): Plan {
  return {
    id: p.id,
    kind: p.kind,
    name: p.name,
    durationMonths: p.duration_months,
    durationDays: p.duration_days,
    pricePaise: p.price_paise,
    maxFreezeDays: p.max_freeze_days,
    trainerCommissionPct: p.trainer_commission_pct,
    active: p.active === 1,
  };
}

export function toMemberProfile(m: MemberRow): MemberProfile {
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    dob: m.dob,
    gender: m.gender,
    batch: m.batch,
    emergencyName: m.emergency_name,
    emergencyPhone: m.emergency_phone,
    guardianName: m.guardian_name,
    guardianPhone: m.guardian_phone,
    status: m.status,
    source: m.source,
    requestNo: m.request_no,
    rejectedReason: m.rejected_reason,
    archivedAt: m.archived_at,
    archivedReason: m.archived_reason,
    consentAt: m.consent_at,
    createdAt: m.created_at,
    pictureUrl: m.picture_url ?? null,
    linkedEmail: m.linked_email ?? null,
    inviteEmail: m.invite_email,
  };
}

export function toSubscription(s: SubscriptionRow): Subscription {
  const total = s.final_price_paise + s.joining_fee_paise;
  const cancelled = s.cancelled_at != null;
  return {
    id: s.id,
    memberId: s.member_id,
    kind: s.kind,
    planId: s.plan_id,
    planName: s.plan_name,
    durationMonths: s.duration_months,
    durationDays: s.duration_days,
    trainerName: s.trainer_name,
    startDate: s.start_date,
    endDate: s.end_date,
    listPricePaise: s.list_price_paise,
    finalPricePaise: s.final_price_paise,
    discountReason: s.discount_reason,
    joiningFeePaise: s.joining_fee_paise,
    backdateReason: s.backdate_reason,
    cancelledAt: s.cancelled_at,
    cancelledReason: s.cancelled_reason,
    createdAt: s.created_at,
    createdByName: s.created_by_name ?? null,
    paidPaise: s.paid_paise,
    duePaise: cancelled ? 0 : Math.max(0, total - s.paid_paise),
    frozenToday: s.frozen_today === 1,
    freezeDaysUsed: s.freeze_days_used,
    maxFreezeDays: s.max_freeze_days,
  };
}

export function toPayment(p: PaymentRow): Payment {
  return {
    id: p.id,
    subscriptionId: p.subscription_id,
    planName: p.plan_name,
    amountPaise: p.amount_paise,
    mode: p.mode,
    paidOn: p.paid_on,
    receiptNo: p.receipt_no,
    collectedByName: p.collected_by_name,
    note: p.note,
    voidedAt: p.voided_at,
    voidReason: p.void_reason,
    createdAt: p.created_at,
    memberId: p.member_id,
    ...(p.member_name ? { memberName: p.member_name } : {}),
  };
}

export function toFreeze(f: FreezeRow): Freeze {
  return {
    id: f.id,
    subscriptionId: f.subscription_id,
    fromDate: f.from_date,
    toDate: f.to_date,
    reason: f.reason,
    createdByName: f.created_by_name,
    createdAt: f.created_at,
  };
}

export function toVisit(v: { id: string; at: string; day: string; result: MembershipState; method: Visit["method"] }): Visit {
  return { id: v.id, at: v.at, day: v.day, result: v.result, method: v.method };
}
