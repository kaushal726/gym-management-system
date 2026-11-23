/* Product rules shared by the API, the cron and the web app. */

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";
export const DEFAULT_GRACE_DAYS = 3;
export const DEFAULT_REMINDER_HOUR = 9;
/** A self-registration nobody activates within this many days becomes a lead. */
export const PENDING_EXPIRY_DAYS = 7;
export const CLAIM_LINK_DAYS = 7;
export const SESSION_DAYS = 30;
/** A member with a live plan who has not checked in for this many days is a churn risk. */
export const NO_SHOW_DAYS = 10;
/** Expiring soon = ends within this many days. */
export const EXPIRING_WINDOW_DAYS = 7;
/** How far back the follow-up list looks for rows nobody has handled. */
export const FOLLOWUP_LOOKBACK_DAYS = 30;
export const MAX_GRACE_DAYS = 30;
export const MAX_FREEZE_DAYS = 180;
/** Default radius for the optional location check on check-in. */
export const DEFAULT_CHECKIN_RADIUS_M = 150;

export const STAFF_ROLES = ["OWNER", "MANAGER", "TRAINER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
/** Roles a gym owner can give. Each gym has one owner, set by the platform admin at onboarding. */
export const TEAM_ROLES = ["MANAGER", "TRAINER"] as const satisfies readonly StaffRole[];
export type TeamRole = (typeof TEAM_ROLES)[number];

export const PAYMENT_MODES = ["CASH", "UPI", "CARD"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const MEMBER_STATUSES = ["PENDING", "JOINED", "LEAD", "REJECTED"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const PLAN_KINDS = ["MEMBERSHIP", "PT"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
