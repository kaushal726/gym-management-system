/* Where a member stands today, worked out only from their subscriptions' dates. Nothing here is stored,
 * so a missed cron run can never leave a member showing the wrong state. */
import { addDays, daysBetween, type IsoDate } from "./dates.ts";

export type MembershipState = "NO_PLAN" | "UPCOMING" | "ACTIVE" | "FROZEN" | "GRACE" | "EXPIRED";

export interface SubDates {
  id: string;
  startDate: IsoDate;
  endDate: IsoDate;
  cancelled: boolean;
  /** Whether a freeze covers today. */
  frozenToday: boolean;
}

export interface MembershipSummary<S extends SubDates = SubDates> {
  state: MembershipState;
  /** The subscription that covers today, else the one that ended last. */
  current: S | null;
  /** The earliest subscription that starts after today. */
  upcoming: S | null;
  /** The subscription that ends last: reminders and renewals hang off it. */
  chainEnd: S | null;
  /** Days left including today's, while covered (0 on the last day). */
  daysLeft: number | null;
  /** Days since the last plan ended, when not covered. */
  daysSinceEnd: number | null;
}

export function summarize<S extends SubDates>(subs: readonly S[], today: IsoDate, graceDays: number): MembershipSummary<S> {
  const live = subs.filter((s) => !s.cancelled);
  const covering = live.find((s) => s.startDate <= today && today <= s.endDate) ?? null;
  const upcoming = live.filter((s) => s.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
  const chainEnd = [...live].sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;
  const lastPast = live.filter((s) => s.endDate < today).sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;

  if (covering) {
    return {
      state: covering.frozenToday ? "FROZEN" : "ACTIVE",
      current: covering,
      upcoming,
      chainEnd,
      daysLeft: daysBetween(today, covering.endDate),
      daysSinceEnd: null,
    };
  }
  if (upcoming) {
    return { state: "UPCOMING", current: lastPast, upcoming, chainEnd, daysLeft: null, daysSinceEnd: lastPast ? daysBetween(lastPast.endDate, today) : null };
  }
  if (lastPast) {
    const since = daysBetween(lastPast.endDate, today);
    return { state: since <= graceDays ? "GRACE" : "EXPIRED", current: lastPast, upcoming: null, chainEnd, daysLeft: null, daysSinceEnd: since };
  }
  return { state: "NO_PLAN", current: null, upcoming: null, chainEnd: null, daysLeft: null, daysSinceEnd: null };
}

/** Where a new subscription should start: the day after the current chain ends, or today if it has already ended. */
export function nextStartDate(subs: readonly SubDates[], today: IsoDate): IsoDate {
  const lastEnd = subs.filter((s) => !s.cancelled).reduce<IsoDate | null>((max, s) => (max == null || s.endDate > max ? s.endDate : max), null);
  if (lastEnd == null || lastEnd < today) return today;
  return addDays(lastEnd, 1);
}

/** Whether a proposed subscription would overlap one that is already live. */
export function overlapsLive(subs: readonly SubDates[], startDate: IsoDate, endDate: IsoDate, ignoreId?: string): boolean {
  return subs.some((s) => !s.cancelled && s.id !== ignoreId && s.startDate <= endDate && startDate <= s.endDate);
}

/** States in which the member may train today. */
export function mayEnter(state: MembershipState): boolean {
  return state === "ACTIVE" || state === "GRACE";
}

export const STATE_LABEL: Record<MembershipState, string> = {
  NO_PLAN: "No plan",
  UPCOMING: "Starts soon",
  ACTIVE: "Active",
  FROZEN: "Frozen",
  GRACE: "In grace",
  EXPIRED: "Expired",
};
