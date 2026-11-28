/* The WhatsApp message a gym sends when a member's plan is about to end (or just did): friendly, a little promotional,
 * and it ends with an easy next step. It is separate from the short push-notification text in reminders.ts, which has to
 * stay a line or two. Written in simple, friendly English, with WhatsApp's *bold* for what matters. Change the wording here only. */
import type { IsoDate } from "./dates.ts";
import type { MembershipSummary } from "./membership.ts";
import { EXPIRY_OFFSETS, displayDate, reminderMessage, type MessageContext, type ReminderType } from "./reminders.ts";

/** Within this many days of the end, a plan counts as "ending soon" for a message. */
export const ENDING_SOON_DAYS = 7;
/** After this many days past the end, the message changes from "renew now" to "we miss you". */
export const RECENTLY_ENDED_DAYS = 14;

export interface PitchContext {
  memberName: string;
  gymName: string;
  planName: string | null;
  endDate: IsoDate | null;
  /** Days until the plan ends (0 = last day). Negative once it has ended: -3 means it ended 3 days ago. */
  daysLeft: number;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The friendly renewal message for a plan with `daysLeft` days to go, or that ended `-daysLeft` days ago. */
export function renewalPitch(ctx: PitchContext): string {
  const hi = `Hi ${firstName(ctx.memberName)}!`;
  const plan = ctx.planName ? `*${ctx.planName}* plan` : "membership";
  const gym = `*${ctx.gymName}*`;
  const end = ctx.endDate ? displayDate(ctx.endDate) : "soon";
  const signoff = `Team ${ctx.gymName}`;

  if (ctx.daysLeft >= 2) {
    return [
      `${hi} 💪`,
      `Your ${gym} ${plan} ends on *${end}*, just ${ctx.daysLeft} days to go.`,
      `You've built great momentum, so don't let it stop! Renew now and keep your fitness journey going without a break 🔥`,
      `Drop by the desk to renew, or simply reply to this message. We'll take care of the rest.`,
      signoff,
    ].join("\n\n");
  }
  if (ctx.daysLeft === 1) {
    return [
      `${hi} ⏰`,
      `Your ${gym} ${plan} ends tomorrow (*${end}*).`,
      `Renew today or tomorrow so your workouts don't miss a single day. Want to keep that streak alive? 💪`,
      `Reply to this message or visit the desk.`,
      signoff,
    ].join("\n\n");
  }
  if (ctx.daysLeft === 0) {
    return [
      `${hi} 🔥`,
      `Today is the *last day* of your ${gym} ${plan}.`,
      `Renew today and keep training from tomorrow without a break. Visit the desk, we're ready!`,
      signoff,
    ].join("\n\n");
  }
  if (ctx.daysLeft >= -RECENTLY_ENDED_DAYS) {
    return [
      `${hi}`,
      `Your ${gym} ${plan} ended on *${end}*, but it's not too late!`,
      `Renew today and get right back to your routine. The sooner you restart, the smaller the break 💪`,
      `Reply to this message or visit the desk, we're right here.`,
      signoff,
    ].join("\n\n");
  }
  return [
    `${hi} 🙂`,
    `We miss you at ${gym}! Your ${plan} ended on *${end}*.`,
    `There's no better time to restart your fitness journey. Come back, renew, and we'll be waiting for you 💪`,
    `Just reply to this message.`,
    signoff,
  ].join("\n\n");
}

/** What the owner's one-tap WhatsApp button says for a follow-up: the pitch for expiry and renewal reminders, the plain reminder otherwise. */
export function whatsappText(type: ReminderType, ctx: MessageContext & { planName: string | null }): string {
  const offset = EXPIRY_OFFSETS[type];
  if (offset === undefined) return reminderMessage(type, ctx).body;
  return renewalPitch({ memberName: ctx.memberName, gymName: ctx.gymName, planName: ctx.planName, endDate: ctx.endDate, daysLeft: -offset });
}

export interface MemberStanding {
  state: MembershipSummary["state"];
  daysLeft: number | null;
  daysSinceEnd: number | null;
  /** The plan that covers today, else the one that ended last. */
  current: { planName: string; endDate: IsoDate } | null;
  /** A renewal already waiting to start. */
  upcoming: unknown;
}

/** The text on a member's WhatsApp button: a renewal pitch if their plan is ending soon or has ended, else just a greeting. */
export function memberWhatsappText(standing: MemberStanding, ctx: { memberName: string; gymName: string }): string {
  const greeting = `Hi ${firstName(ctx.memberName)},`;
  if (standing.upcoming || !standing.current) return greeting;
  const pitch = (daysLeft: number) => renewalPitch({ ...ctx, planName: standing.current?.planName ?? null, endDate: standing.current?.endDate ?? null, daysLeft });
  const covered = standing.state === "ACTIVE" || standing.state === "FROZEN";
  if (covered && standing.daysLeft !== null && standing.daysLeft <= ENDING_SOON_DAYS) return pitch(standing.daysLeft);
  if ((standing.state === "GRACE" || standing.state === "EXPIRED") && standing.daysSinceEnd !== null) return pitch(-standing.daysSinceEnd);
  return greeting;
}

