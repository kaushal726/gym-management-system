/* Read-only building blocks of the member page. Shared by the member's own view and the desk's member detail. */
import type { ReactNode } from "react";
import { PiCalendarBlankDuotone, PiPauseCircleBold, PiWalletDuotone } from "react-icons/pi";
import type { Freeze, Payment, StateSummary, Subscription, Visit } from "../../../../shared/api.ts";
import { daysBetween } from "../../../../shared/dates.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { formatDate, formatDateTime, formatDayMonth, planLength, plural } from "../../lib/format.ts";
import { MODE_LABEL } from "../../lib/states.ts";
import { Badge, EmptyState, StateBadge } from "../../components/ui/Feedback.tsx";
import { Ring } from "../../components/ui/Ring.tsx";

const RING_COLOR = { ACTIVE: "var(--accent)", FROZEN: "var(--accent)", GRACE: "var(--warning)", EXPIRED: "var(--danger)", UPCOMING: "var(--accent)", NO_PLAN: "var(--border-strong)" } as const;

export function MembershipHero({ summary, today, chainEnd }: { summary: StateSummary; today: string; chainEnd: string | null }) {
  const sub = summary.current ?? summary.upcoming;
  const covered = summary.state === "ACTIVE" || summary.state === "FROZEN";
  const left = covered && chainEnd ? daysBetween(today, chainEnd) : 0;
  const total = sub ? daysBetween(sub.startDate, chainEnd ?? sub.endDate) + 1 : 1;
  // Same count as the desk sees: days after today until the plan ends; the end date itself is "last day".
  const ringNumber = covered ? (left === 0 ? "Today" : String(left)) : summary.state === "UPCOMING" && sub ? String(daysBetween(today, sub.startDate)) : "0";
  const ringUnit = covered ? (left === 0 ? "last day" : left === 1 ? "day left" : "days left") : summary.state === "UPCOMING" ? "days to start" : "days left";

  return (
    <div className="hero-card hero-card--ring enter">
      <Ring value={covered ? Math.max(left, 1) : 0} max={total} number={ringNumber} unit={ringUnit} color={RING_COLOR[summary.state]} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <StateBadge state={summary.state} />
        <h2>{sub?.planName ?? "No plan yet"}</h2>
        {covered && chainEnd && <p className="muted">Valid till {formatDate(chainEnd)}</p>}
        {summary.state === "UPCOMING" && summary.upcoming && <p className="muted">Starts on {formatDate(summary.upcoming.startDate)}</p>}
        {(summary.state === "GRACE" || summary.state === "EXPIRED") && summary.current && (
          <p style={{ color: summary.state === "GRACE" ? "var(--warning)" : "var(--danger)", fontWeight: 600 }}>Ended on {formatDate(summary.current.endDate)}. Renew at the desk.</p>
        )}
        {summary.state === "NO_PLAN" && <p className="muted">The desk will start your plan.</p>}
        {covered && summary.upcoming && <Badge tone="accent">Renewed: {summary.upcoming.planName} from {formatDayMonth(summary.upcoming.startDate)}</Badge>}
      </div>
    </div>
  );
}

/** A list row that is a button when the screen lets you act on it (the desk), plain text otherwise (the member). */
function Row({ onSelect, label, children }: { onSelect?: () => void; label: string; children: ReactNode }) {
  if (!onSelect) return <div className="list-row">{children}</div>;
  return (
    <button type="button" className="list-row" onClick={onSelect} aria-label={label}>
      {children}
    </button>
  );
}

export function PaymentList({ payments, emptyText = "No payments yet.", onSelect }: { payments: Payment[]; emptyText?: string; onSelect?: (p: Payment) => void }) {
  if (payments.length === 0) return <EmptyState icon={<PiWalletDuotone />} title="No receipts" text={emptyText} />;
  return (
    <div className="list">
      {payments.map((p) => (
        <Row key={p.id} onSelect={onSelect && (() => onSelect(p))} label={`Receipt ${p.receiptNo}`}>
          <div className="list-row__main">
            <span className="list-row__title">
              {p.amountPaise < 0 ? "Refund" : p.planName} <span className="muted tabular">· #{p.receiptNo}</span>
            </span>
            <span className="list-row__sub">
              {formatDate(p.paidOn)} · {MODE_LABEL[p.mode]}
              {p.collectedByName ? ` · ${p.collectedByName}` : ""}
            </span>
          </div>
          <div className="list-row__end">
            <span className={`tabular${p.voidedAt ? " strike" : ""}`} style={{ fontWeight: 700 }}>
              {formatRupees(p.amountPaise)}
            </span>
            {p.voidedAt && <Badge tone="danger">Voided</Badge>}
          </div>
        </Row>
      ))}
    </div>
  );
}

export function SubscriptionList({ subscriptions, today, onSelect }: { subscriptions: Subscription[]; today: string; onSelect?: (s: Subscription) => void }) {
  if (subscriptions.length === 0) return <EmptyState icon={<PiCalendarBlankDuotone />} title="No plans yet" />;
  return (
    <div className="list">
      {subscriptions.map((s) => {
        const state = s.cancelledAt ? null : s.startDate > today ? "UPCOMING" : s.endDate < today ? "EXPIRED" : s.frozenToday ? "FROZEN" : "ACTIVE";
        return (
          <Row key={s.id} onSelect={onSelect && (() => onSelect(s))} label={s.planName}>
            <div className="list-row__main">
              <span className="list-row__title">
                {s.planName}
                {s.kind === "PT" && s.trainerName ? ` · ${s.trainerName}` : ""}
              </span>
              <span className="list-row__sub">
                {formatDate(s.startDate)} – {formatDate(s.endDate)} · {planLength(s.durationMonths, s.durationDays)}
              </span>
            </div>
            <div className="list-row__end">
              <span className="tabular" style={{ fontWeight: 600 }}>
                {formatRupees(s.finalPricePaise + s.joiningFeePaise)}
              </span>
              {s.cancelledAt ? <Badge tone="danger">Cancelled</Badge> : state === "EXPIRED" ? <Badge>Ended</Badge> : <StateBadge state={state ?? "NO_PLAN"} />}
              {s.duePaise > 0 && (
                <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: "var(--warning)" }}>
                  {formatRupees(s.duePaise)} due
                </span>
              )}
            </div>
          </Row>
        );
      })}
    </div>
  );
}

export function FreezeList({ freezes }: { freezes: Freeze[] }) {
  if (freezes.length === 0) return null;
  return (
    <div className="list">
      {freezes.map((f) => (
        <div className="list-row" key={f.id}>
          <PiPauseCircleBold aria-hidden style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div className="list-row__main">
            <span className="list-row__title">
              {formatDayMonth(f.fromDate)} – {formatDate(f.toDate)}
            </span>
            <span className="list-row__sub">{f.reason}</span>
          </div>
          <span className="muted tabular">{plural(daysBetween(f.fromDate, f.toDate) + 1, "day")}</span>
        </div>
      ))}
    </div>
  );
}

export function VisitSummary({ visits, today }: { visits: Visit[]; today: string }) {
  const month = today.slice(0, 7);
  const thisMonth = visits.filter((v) => v.day.startsWith(month)).length;
  return (
    <div className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3>Visits this month</h3>
        <span className="stat__value" style={{ fontSize: 28 }}>
          {thisMonth}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        {visits[0] ? `Last visit ${formatDateTime(visits[0].at)}` : "No visits yet."}
      </p>
    </div>
  );
}
