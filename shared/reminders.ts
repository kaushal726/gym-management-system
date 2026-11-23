/* Which reminders fall due for a member on a given day, and what they say. The same text goes into the
 * push notification and into the owner's one-tap WhatsApp message, so there is one wording to maintain. */
import { daysBetween, type IsoDate } from "./dates.ts";
import { formatRupees, type Paise } from "./money.ts";
import { NO_SHOW_DAYS } from "./constants.ts";
import type { MembershipSummary, SubDates } from "./membership.ts";

export const REMINDER_TYPES = ["EXPIRY_M5", "EXPIRY_M1", "EXPIRY_0", "EXPIRED_P3", "RENEW_P7", "RENEW_P15", "DUES", "NO_SHOW", "LEAD"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

/** Days after the end date (negative = before it) on which each expiry reminder goes out. */
export const EXPIRY_OFFSETS: Partial<Record<ReminderType, number>> = {
  EXPIRY_M5: -5,
  EXPIRY_M1: -1,
  EXPIRY_0: 0,
  EXPIRED_P3: 3,
  RENEW_P7: 7,
  RENEW_P15: 15,
};

/** While money is owed, a dues reminder goes out every this many days after the plan started. */
export const DUES_EVERY_DAYS = 3;

export interface DueSub {
  id: string;
  startDate: IsoDate;
  duePaise: Paise;
}

export interface ReminderInput {
  summary: MembershipSummary<SubDates>;
  dueSubs: readonly DueSub[];
  /** Last check-in day, when the gym uses check-in. */
  lastVisit: IsoDate | null;
  checkinEnabled: boolean;
}

export interface DueReminder {
  type: ReminderType;
  subscriptionId: string;
}

export function remindersFor(input: ReminderInput, today: IsoDate): DueReminder[] {
  const out: DueReminder[] = [];
  const { chainEnd, state } = input.summary;

  if (chainEnd) {
    const offset = daysBetween(chainEnd.endDate, today);
    for (const [type, at] of Object.entries(EXPIRY_OFFSETS) as [ReminderType, number][]) {
      if (offset === at) out.push({ type, subscriptionId: chainEnd.id });
    }
  }

  for (const sub of input.dueSubs) {
    const sinceStart = daysBetween(sub.startDate, today);
    if (sub.duePaise > 0 && sinceStart > 0 && sinceStart % DUES_EVERY_DAYS === 0) out.push({ type: "DUES", subscriptionId: sub.id });
  }

  const current = input.summary.current;
  if (input.checkinEnabled && state === "ACTIVE" && current) {
    const lastSeen = input.lastVisit && input.lastVisit >= current.startDate ? input.lastVisit : current.startDate;
    if (daysBetween(lastSeen, today) === NO_SHOW_DAYS) out.push({ type: "NO_SHOW", subscriptionId: current.id });
  }
  return out;
}

export interface MessageContext {
  memberName: string;
  gymName: string;
  endDate: IsoDate | null;
  duePaise: Paise;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function displayDate(date: IsoDate | null): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export interface ReminderMessage {
  title: string;
  body: string;
}

export function reminderMessage(type: ReminderType, ctx: MessageContext): ReminderMessage {
  const hi = `Hi ${firstName(ctx.memberName)},`;
  const end = displayDate(ctx.endDate);
  switch (type) {
    case "EXPIRY_M5":
      return { title: "Membership ends in 5 days", body: `${hi} your ${ctx.gymName} membership ends on ${end}. Renew at the desk to keep training without a break.` };
    case "EXPIRY_M1":
      return { title: "Membership ends tomorrow", body: `${hi} your ${ctx.gymName} membership ends tomorrow (${end}). Renew at the desk today.` };
    case "EXPIRY_0":
      return { title: "Membership ends today", body: `${hi} today is the last day of your ${ctx.gymName} membership. Renew at the desk to continue.` };
    case "EXPIRED_P3":
      return { title: "Membership expired", body: `${hi} your ${ctx.gymName} membership ended on ${end}. Renew at the desk to get back on track.` };
    case "RENEW_P7":
    case "RENEW_P15":
      return { title: "We miss you", body: `${hi} it has been a while since your ${ctx.gymName} membership ended on ${end}. Come back and renew any time.` };
    case "DUES":
      return { title: "Payment pending", body: `${hi} ${formatRupees(ctx.duePaise)} is pending on your ${ctx.gymName} membership. Please clear it at the desk.` };
    case "NO_SHOW":
      return { title: "Haven't seen you lately", body: `${hi} we haven't seen you at ${ctx.gymName} for ${NO_SHOW_DAYS} days. Your plan is active till ${end}. See you soon.` };
    case "LEAD":
      return { title: "Join us", body: `${hi} you had registered at ${ctx.gymName}. Visit the desk to pick a plan and start training.` };
  }
}

export const REMINDER_LABEL: Record<ReminderType, string> = {
  EXPIRY_M5: "Ends in 5 days",
  EXPIRY_M1: "Ends tomorrow",
  EXPIRY_0: "Ends today",
  EXPIRED_P3: "Expired 3 days ago",
  RENEW_P7: "Expired 7 days ago",
  RENEW_P15: "Expired 15 days ago",
  DUES: "Payment pending",
  NO_SHOW: "Not coming",
  LEAD: "Registered, never joined",
};
