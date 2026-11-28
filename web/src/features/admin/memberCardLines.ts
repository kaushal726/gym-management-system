/* What each line of a member card says. Pure, so every case (active, ending, ended, pending, no plan) is easy to test. */
import type { MemberListItem } from "../../../../shared/api.ts";
import type { IsoDate } from "../../../../shared/dates.ts";
import { BATCH_LABEL } from "../../../../shared/constants.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { formatMobile } from "../../../../shared/phone.ts";
import { formatAgo, formatDayMonth, plural } from "../../lib/format.ts";

/** A plan with this many days left or fewer is shown as ending soon. */
export const ENDING_SOON_DAYS = 7;

export type LineTone = "warning" | "danger";

export interface CardText {
  text: string;
  tone?: LineTone;
}

export interface MemberCardLines {
  contact: string;
  /** The plan name, or null for someone who has not joined. */
  plan: string | null;
  showPt: boolean;
  validity: CardText | null;
  /** Dues first; otherwise when they last came. */
  aside: CardText | null;
}

function validityOf(m: MemberListItem): CardText | null {
  if (m.status === "PENDING") return { text: `Request${m.requestNo != null ? ` #${m.requestNo}` : ""} · ${formatAgo(m.createdAt)}` };
  if (m.status !== "JOINED") return { text: `Signed up ${formatAgo(m.createdAt)}` };
  switch (m.state) {
    case "ACTIVE":
    case "FROZEN": {
      const left = m.daysLeft ?? 0;
      const text = `Ends ${formatDayMonth(m.endDate)} · ${left === 0 ? "last day" : `${plural(left, "day")} left`}`;
      return m.state === "ACTIVE" && left <= ENDING_SOON_DAYS ? { text, tone: "warning" } : { text };
    }
    case "GRACE":
    case "EXPIRED": {
      const since = m.daysSinceEnd ?? 0;
      const text = `Ended ${formatDayMonth(m.endDate)} · ${since === 0 ? "today" : `${plural(since, "day")} ago`}`;
      return { text, tone: m.state === "GRACE" ? "warning" : "danger" };
    }
    case "UPCOMING":
      return { text: "Starts soon" };
    default:
      return null;
  }
}

function asideOf(m: MemberListItem, today: IsoDate): CardText | null {
  if (m.duePaise > 0) return { text: `${formatRupees(m.duePaise)} due`, tone: "warning" };
  if (m.status !== "JOINED" || !m.lastVisit) return null;
  return { text: m.lastVisit === today ? "Visited today" : `Last visit ${formatDayMonth(m.lastVisit)}` };
}

export function memberCardLines(m: MemberListItem, today: IsoDate): MemberCardLines {
  return {
    contact: [formatMobile(m.phone), m.batch ? BATCH_LABEL[m.batch] : null].filter(Boolean).join(" · "),
    plan: m.status === "JOINED" ? (m.planName ?? "No plan") : null,
    showPt: m.status === "JOINED" && m.ptActive,
    validity: validityOf(m),
    aside: asideOf(m, today),
  };
}
