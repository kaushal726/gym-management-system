/* How each membership state looks in the UI. The labels come from shared/, the colours from here. */
import type { MembershipState } from "../../../shared/membership.ts";
import { STATE_LABEL } from "../../../shared/membership.ts";
import type { MemberStatus } from "../../../shared/constants.ts";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export const STATE_TONE: Record<MembershipState, Tone> = {
  NO_PLAN: "neutral",
  UPCOMING: "accent",
  ACTIVE: "success",
  FROZEN: "accent",
  GRACE: "warning",
  EXPIRED: "danger",
};

export const STATUS_LABEL: Record<MemberStatus, string> = {
  PENDING: "Pending",
  JOINED: "Member",
  LEAD: "Lead",
  REJECTED: "Rejected",
};

export const STATUS_TONE: Record<MemberStatus, Tone> = {
  PENDING: "warning",
  JOINED: "neutral",
  LEAD: "neutral",
  REJECTED: "danger",
};

export { STATE_LABEL };

import type { StaffRole } from "../../../shared/constants.ts";

export const ROLE_LABEL: Record<StaffRole, string> = { OWNER: "Owner", MANAGER: "Manager", TRAINER: "Trainer" };

export const MODE_LABEL = { CASH: "Cash", UPI: "UPI", CARD: "Card" } as const;
