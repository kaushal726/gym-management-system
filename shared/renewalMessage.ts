/* The WhatsApp message a gym sends when a member's plan is about to end (or just did): friendly, a little promotional,
 * and it ends with an easy next step. It is separate from the short push-notification text in reminders.ts, which has to
 * stay a line or two. Written in simple Hinglish, with WhatsApp's *bold* for what matters. Change the wording here only. */
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
  const end = ctx.endDate ? displayDate(ctx.endDate) : "jaldi";
  const signoff = `Team ${ctx.gymName}`;

  if (ctx.daysLeft >= 2) {
    return [
      `${hi} 💪`,
      `Aapka ${gym} ka ${plan} *${end}* ko khatam ho raha hai, bas ${ctx.daysLeft} din bache hain.`,
      `Itni mehnat se jo momentum banaya hai, use rukne mat do! Abhi renew kar lo aur bina kisi break ke apni fitness journey chalate raho 🔥`,
      `Desk pe aake renew kar lo, ya bas is message ka reply kar do. Hum sab sambhal lenge.`,
      signoff,
    ].join("\n\n");
  }
  if (ctx.daysLeft === 1) {
    return [
      `${hi} ⏰`,
      `Kal (*${end}*) aapka ${gym} ka ${plan} khatam ho raha hai.`,
      `Aaj ya kal desk pe renew kar lo, taaki aapki workout ek din bhi na ruke. Streak banaye rakhna hai na? 💪`,
      `Reply kar do ya seedha desk pe aa jao.`,
      signoff,
    ].join("\n\n");
  }
  if (ctx.daysLeft === 0) {
    return [
      `${hi} 🔥`,
      `Aaj aapke ${gym} ke ${plan} ka *last day* hai.`,
      `Aaj hi renew kar lo aur kal se bhi bina ruke train karte raho. Desk pe aao, hum ready hain!`,
      signoff,
    ].join("\n\n");
  }
  if (ctx.daysLeft >= -RECENTLY_ENDED_DAYS) {
    return [
      `${hi}`,
      `Aapka ${gym} ka ${plan} *${end}* ko khatam ho gaya. Par abhi bhi der nahi hui!`,
      `Aaj hi renew karo aur wapas apni routine pe aa jao. Jitni jaldi shuru, utna kam break ka asar 💪`,
      `Reply kar do ya desk pe aa jao, hum yahin hain.`,
      signoff,
    ].join("\n\n");
  }
  return [
    `${hi} 🙂`,
    `${gym} mein aapki kami mehsoos ho rahi hai. Aapka ${plan} *${end}* ko khatam hua tha.`,
    `Fitness journey phir se shuru karne ka isse accha time nahi. Wapas aao, renew karo, hum aapka wait kar rahe hain 💪`,
    `Bas is message ka reply kar do.`,
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

