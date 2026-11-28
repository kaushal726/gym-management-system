/* The contract between the Worker API and the web app. Both sides import these types, so a change to a
 * response shape fails the type check on whichever side was not updated. */
import type { IsoDate } from "./dates.ts";
import type { Paise } from "./money.ts";
import type { MembershipState } from "./membership.ts";
import type { Batch, Gender, MemberStatus, PaymentMode, PlanKind, StaffRole } from "./constants.ts";
import type { ReminderType } from "./reminders.ts";
import type { GymAccess, GymStatus, SaasPaymentMode } from "./saas.ts";

export interface ApiErrorBody {
  error: string;
  field?: string;
  /** Machine-readable reason, e.g. GYM_PAUSED, so the app can show the right screen. */
  code?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
}

export interface StaffGym {
  gymId: string;
  gymName: string;
  gymSlug: string;
  role: StaffRole;
  access: GymAccess;
  validTill: IsoDate | null;
}

export interface MemberOf {
  gymId: string;
  gymName: string;
  gymSlug: string;
  memberId: string;
  status: MemberStatus;
}

export interface SessionInfo {
  user: SessionUser | null;
  staffOf: StaffGym[];
  memberOf: MemberOf[];
  isPlatformAdmin: boolean;
}

export interface AppConfig {
  googleClientId: string | null;
  devLogin: boolean;
  vapidPublicKey: string | null;
  allowGymSignup: boolean;
}

export interface PublicGym {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  address: string | null;
  checkinEnabled: boolean;
  checkinNeedsLocation: boolean;
  /** The batches this gym runs. */
  batches: Batch[];
  /** False while the gym is paused or archived: no sign-ups or check-ins. */
  open: boolean;
}

export interface GymEntry {
  gym: PublicGym;
  member: { id: string; status: MemberStatus; requestNo: number | null; name: string } | null;
}

export interface RegisterInput {
  name: string;
  phone: string;
  dob: IsoDate | null;
  gender: Gender | null;
  emergencyName: string;
  emergencyPhone: string;
  guardianName: string | null;
  guardianPhone: string | null;
  batch: Batch | null;
  consent: boolean;
}

export interface GymSettings {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  upiId: string | null;
  graceDays: number;
  joiningFeePaise: Paise;
  checkinEnabled: boolean;
  checkinLat: number | null;
  checkinLng: number | null;
  checkinRadiusM: number | null;
  reminderHour: number;
  batches: Batch[];
}

export interface Plan {
  id: string;
  kind: PlanKind;
  name: string;
  durationMonths: number | null;
  durationDays: number | null;
  pricePaise: Paise;
  maxFreezeDays: number;
  trainerCommissionPct: number;
  active: boolean;
}

export type PlanInput = Omit<Plan, "id" | "active"> & { active?: boolean };

export interface Subscription {
  id: string;
  memberId: string;
  kind: PlanKind;
  planId: string | null;
  planName: string;
  durationMonths: number | null;
  durationDays: number | null;
  trainerName: string | null;
  startDate: IsoDate;
  endDate: IsoDate;
  listPricePaise: Paise;
  finalPricePaise: Paise;
  discountReason: string | null;
  joiningFeePaise: Paise;
  backdateReason: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  createdAt: string;
  createdByName: string | null;
  paidPaise: Paise;
  duePaise: Paise;
  frozenToday: boolean;
  freezeDaysUsed: number;
  maxFreezeDays: number;
}

export interface Payment {
  id: string;
  subscriptionId: string;
  planName: string;
  amountPaise: Paise;
  mode: PaymentMode;
  paidOn: IsoDate;
  receiptNo: number;
  collectedByName: string | null;
  note: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  memberId: string;
  memberName?: string;
}

export interface Freeze {
  id: string;
  subscriptionId: string;
  fromDate: IsoDate;
  toDate: IsoDate;
  reason: string;
  createdByName: string | null;
  createdAt: string;
}

export interface Visit {
  id: string;
  at: string;
  day: IsoDate;
  result: MembershipState;
  method: "QR" | "DESK" | "OFFLINE";
}

export interface MemberProfile {
  id: string;
  name: string;
  phone: string;
  dob: IsoDate | null;
  gender: Gender | null;
  batch: Batch | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  status: MemberStatus;
  source: "QR" | "DESK";
  requestNo: number | null;
  rejectedReason: string | null;
  archivedAt: string | null;
  archivedReason: string | null;
  consentAt: string | null;
  createdAt: string;
  pictureUrl: string | null;
  linkedEmail: string | null;
  /** The Gmail staff added; the first Google sign-in with it links the member. */
  inviteEmail: string | null;
}

export interface StateSummary {
  state: MembershipState;
  daysLeft: number | null;
  daysSinceEnd: number | null;
  current: Subscription | null;
  upcoming: Subscription | null;
}

export interface MemberListItem {
  id: string;
  name: string;
  phone: string;
  pictureUrl: string | null;
  status: MemberStatus;
  source: "QR" | "DESK";
  requestNo: number | null;
  archived: boolean;
  createdAt: string;
  linked: boolean;
  state: MembershipState;
  planName: string | null;
  endDate: IsoDate | null;
  daysLeft: number | null;
  daysSinceEnd: number | null;
  hasUpcoming: boolean;
  duePaise: Paise;
  ptActive: boolean;
  lastVisit: IsoDate | null;
  batch: Batch | null;
}

export const MEMBER_FILTERS = ["all", "pending", "active", "expiring", "grace", "expired", "dues", "frozen", "leads", "archived"] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

export interface MemberDetail {
  today: IsoDate;
  graceDays: number;
  member: MemberProfile;
  membership: StateSummary;
  pt: StateSummary;
  subscriptions: Subscription[];
  payments: Payment[];
  freezes: Freeze[];
  visits: Visit[];
  phoneHistory: { oldPhone: string; newPhone: string; changedAt: string; changedByName: string | null }[];
  nextStartDate: IsoDate;
  nextPtStartDate: IsoDate;
  isFirstSubscription: boolean;
  duesTotalPaise: Paise;
}

export interface MemberInput {
  name: string;
  phone: string;
  dob: IsoDate | null;
  gender: Gender | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  email: string | null;
  batch: Batch | null;
}

export interface ActivateInput {
  planId: string;
  startDate: IsoDate;
  finalPricePaise: Paise;
  discountReason: string | null;
  joiningFeePaise: Paise;
  backdateReason: string | null;
  trainerName: string | null;
  payment: { amountPaise: Paise; mode: PaymentMode; note: string | null } | null;
}

export interface PaymentInput {
  amountPaise: Paise;
  mode: PaymentMode;
  note: string | null;
}

export interface CancelInput {
  reason: string;
  refund: { amountPaise: Paise; mode: PaymentMode } | null;
}

export interface FreezeInput {
  fromDate: IsoDate;
  days: number;
  reason: string;
}

export interface CollectionSummary {
  totalPaise: Paise;
  count: number;
  byMode: Record<PaymentMode, Paise>;
  byStaff: { name: string; totalPaise: Paise; count: number }[];
}

export interface Dashboard {
  today: IsoDate;
  role: StaffRole;
  counts: {
    active: number;
    expiringSoon: number;
    grace: number;
    expired: number;
    frozen: number;
    pending: number;
    withDues: number;
    openFollowups: number;
    checkinsToday: number;
  };
  duesTotalPaise: Paise;
  pending: MemberListItem[];
  expiringSoon: MemberListItem[];
  /** Owner only. */
  collectionToday: CollectionSummary | null;
  /** Owner only. */
  collectionMonthPaise: Paise | null;
}

export interface Followup {
  id: string;
  type: ReminderType;
  label: string;
  forDate: IsoDate;
  pushFailed: boolean;
  contactedAt: string | null;
  contactedByName: string | null;
  note: string | null;
  member: { id: string; name: string; phone: string };
  message: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  at: string;
}

export interface StaffEntry {
  email: string;
  userName: string | null;
  role: StaffRole;
  active: boolean;
  linked: boolean;
}

export interface CollectionsReport {
  from: IsoDate;
  to: IsoDate;
  summary: CollectionSummary;
  payments: Payment[];
  trainers: { trainerName: string; collectedPaise: Paise; commissionPaise: Paise }[];
}

export interface MeMembership {
  today: IsoDate;
  gym: PublicGym & { upiId: string | null };
  member: MemberProfile;
  membership: StateSummary;
  pt: StateSummary;
  subscriptions: Subscription[];
  payments: Payment[];
  freezes: Freeze[];
  visits: Visit[];
  duesTotalPaise: Paise;
}

export interface CheckinResult {
  result: MembershipState;
  memberName: string;
  pictureUrl: string | null;
  endDate: IsoDate | null;
  at: string;
  alreadyToday: boolean;
}

export interface CheckinFeedItem {
  id: string;
  at: string;
  result: MembershipState;
  method: "QR" | "DESK" | "OFFLINE";
  member: { id: string; name: string; phone: string; pictureUrl: string | null };
}

export interface ClaimLink {
  url: string;
  expiresAt: string;
  whatsappText: string;
}

export interface PlatformGym {
  id: string;
  slug: string;
  name: string;
  status: GymStatus;
  access: GymAccess;
  validTill: IsoDate | null;
  saasPlanName: string | null;
  ownerEmail: string | null;
  ownerLastLoginAt: string | null;
  members: number;
  activeMembers: number;
  pending: number;
  staff: number;
  lastActivityAt: string | null;
  createdAt: string;
}

export interface GymBillingEntry {
  id: string;
  planName: string;
  amountPaise: Paise;
  mode: SaasPaymentMode;
  paidOn: IsoDate;
  validTillBefore: IsoDate | null;
  validTillAfter: IsoDate;
  note: string | null;
  createdAt: string;
}

export interface PlatformGymDetail {
  today: IsoDate;
  gym: PlatformGym & { phone: string | null; address: string | null; statusReason: string | null; statusChangedAt: string | null };
  staff: (StaffEntry & { lastLoginAt: string | null })[];
  billing: GymBillingEntry[];
}

/** What the platform admin sees at the top of a gym's owner's view: its numbers, plans and settings. The member list is a separate call. */
export interface GymOverview {
  today: IsoDate;
  counts: { active: number; expiringSoon: number; grace: number; expired: number; frozen: number; pending: number; withDues: number };
  duesTotalPaise: Paise;
  collectedTodayPaise: Paise;
  collectedMonthPaise: Paise;
  /** Today's collection by how it was paid. */
  collectedTodayByMode: Record<PaymentMode, Paise>;
  plans: Plan[];
  settings: GymSettings;
}

export interface GymBillingInput {
  planName: string;
  amountPaise: Paise;
  mode: SaasPaymentMode;
  paidOn: IsoDate;
  validTill: IsoDate;
  note: string | null;
}

export interface CreateGymInput {
  name: string;
  slug: string;
  ownerEmail: string;
  phone: string | null;
  address: string | null;
  saasPlanName: string | null;
  validTill: IsoDate | null;
}

export interface GymDetailsInput {
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
}
