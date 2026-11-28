/* The gym's own GymDesk plan, shown to everyone on the team (owner, manager, trainer): a calm line while it is far off,
 * and a clear card with the days left once it is about to end or has just ended. */
import { PiClockCountdownDuotone, PiWarningDiamondDuotone } from "react-icons/pi";
import { daysBetween } from "../../../../shared/dates.ts";
import { SAAS_GRACE_DAYS, SAAS_REMIND_DAYS, type GymAccess } from "../../../../shared/saas.ts";
import type { StaffRole } from "../../../../shared/constants.ts";
import { formatDate, localToday } from "../../lib/format.ts";

interface Props {
  access: GymAccess;
  validTill: string | null;
  role: StaffRole;
}

function daysLeft(validTill: string): number {
  return daysBetween(localToday(), validTill);
}

/** A quiet "valid till" line for a plan that is not close to ending. Nothing when the plan has no end date. */
export function PlanLine({ validTill }: { validTill: string | null }) {
  if (!validTill) return null;
  const left = daysLeft(validTill);
  return (
    <p className="plan-line">
      GymDesk plan valid till <strong>{formatDate(validTill)}</strong> · {left} days left
    </p>
  );
}

/** The prominent card: only for a plan that ends within a week or ended less than the grace period ago. */
export function PlanAlert({ access, validTill, role }: Props) {
  if (!validTill || (access !== "EXPIRING" && access !== "GRACE")) return null;
  const left = daysLeft(validTill);
  const ended = access === "GRACE";
  const big = ended ? Math.max(SAAS_GRACE_DAYS + left, 0) : Math.max(left, 0);
  const unit = big === 1 ? "day" : "days";
  const title = ended ? `Your plan ended on ${formatDate(validTill)}` : left === 0 ? "Your plan ends today" : `Your plan ends on ${formatDate(validTill)}`;
  const text = ended
    ? `The desk pauses in ${big} ${unit}. ${role === "OWNER" ? "Please renew with GymDesk." : "Tell your gym owner to renew with GymDesk."}`
    : role === "OWNER"
      ? "Renew with GymDesk to keep the desk running without a break."
      : "Tell your gym owner to renew with GymDesk so the desk keeps running.";
  const progress = ended ? 0 : Math.max(0, Math.min(1, left / SAAS_REMIND_DAYS));
  return (
    <div className="page" style={{ paddingBottom: 0 }}>
      <section className={`plan-alert${ended ? " plan-alert--ended" : ""}`} role="status">
        <span className="plan-alert__icon" aria-hidden>
          {ended ? <PiWarningDiamondDuotone /> : <PiClockCountdownDuotone />}
        </span>
        <div className="plan-alert__body">
          <p className="plan-alert__title">{title}</p>
          <p className="plan-alert__text">{text}</p>
          <span className="plan-alert__bar" aria-hidden>
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        </div>
        <div className="plan-alert__count">
          <strong>{big}</strong>
          <span>{ended ? `${unit} to pause` : `${unit} left`}</span>
        </div>
      </section>
    </div>
  );
}
