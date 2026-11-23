/* The gym's own GymDesk subscription (what the gym pays the platform), as opposed to members' plans.
 * Access is worked out from the stored status and the valid-till date, so an expired gym pauses itself
 * on time even if no job runs. */
import { daysBetween, type IsoDate } from "./dates.ts";

export const GYM_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;
export type GymStatus = (typeof GYM_STATUSES)[number];

/** After valid_till, the gym keeps working for this many days before it pauses. */
export const SAAS_GRACE_DAYS = 3;
/** The owner is reminded this many days before valid_till (and on the last day). */
export const SAAS_REMIND_DAYS = 7;

export const SAAS_PAYMENT_MODES = ["UPI", "CASH", "CARD", "BANK"] as const;
export type SaasPaymentMode = (typeof SAAS_PAYMENT_MODES)[number];

/**
 * ACTIVE: normal. EXPIRING: within SAAS_REMIND_DAYS of valid_till. GRACE: past valid_till but still open.
 * PAUSED: paused by hand or expired beyond grace; staff are locked out, members can still see their page.
 * ARCHIVED: closed by the platform.
 */
export type GymAccess = "ACTIVE" | "EXPIRING" | "GRACE" | "PAUSED" | "ARCHIVED";

export interface GymSaasState {
  status: GymStatus;
  validTill: IsoDate | null;
}

export function gymAccess(gym: GymSaasState, today: IsoDate): GymAccess {
  if (gym.status === "ARCHIVED") return "ARCHIVED";
  if (gym.status === "PAUSED") return "PAUSED";
  if (!gym.validTill) return "ACTIVE";
  const left = daysBetween(today, gym.validTill);
  if (left < -SAAS_GRACE_DAYS) return "PAUSED";
  if (left < 0) return "GRACE";
  if (left <= SAAS_REMIND_DAYS) return "EXPIRING";
  return "ACTIVE";
}

/** Whether staff may use the gym and the gym takes sign-ups, check-ins and sends reminders. */
export function gymIsOpen(access: GymAccess): boolean {
  return access === "ACTIVE" || access === "EXPIRING" || access === "GRACE";
}

/** True on the days the owner gets a "plan ends soon" reminder. */
export function saasReminderDue(gym: GymSaasState, today: IsoDate): boolean {
  if (gym.status !== "ACTIVE" || !gym.validTill) return false;
  const left = daysBetween(today, gym.validTill);
  return left === SAAS_REMIND_DAYS || left === 1 || left === 0 || left === -1;
}

export const GYM_ACCESS_LABEL: Record<GymAccess, string> = {
  ACTIVE: "Active",
  EXPIRING: "Expiring",
  GRACE: "In grace",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
};
