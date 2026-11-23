/* Today: the staff home. Built like a phone app home: a bold hero with the day's headline numbers, quick
 * actions as round tiles, then what needs attention (waiting at the desk, expiring this week) and, for the
 * owner, today's collection. On desktop the same blocks sit in two columns. */
import { useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiCheckSquare, FiClock, FiGrid, FiInbox, FiLayers, FiPhoneCall, FiUsers } from "react-icons/fi";
import type { Dashboard } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { formatDate } from "../../lib/format.ts";
import { Link } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { MODE_LABEL } from "../../lib/states.ts";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback.tsx";
import { InstallBanner } from "../../components/ui/InstallBanner.tsx";
import { CountUp } from "../../components/ui/CountUp.tsx";
import { RupeeIcon } from "../../components/ui/RupeeIcon.tsx";
import { useAdmin } from "./AdminShell.tsx";
import { MemberRow } from "./MemberRow.tsx";

type AttentionTab = "waiting" | "expiring";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function QuickAction({ href, label, icon, badge, external }: { href: string; label: string; icon: React.ReactNode; badge?: number; external?: boolean }) {
  const inner = (
    <>
      <span className="quick__icon" aria-hidden>
        {icon}
        {badge ? <span className="quick__badge">{badge > 99 ? "99+" : badge}</span> : null}
      </span>
      <span className="quick__label">{label}</span>
    </>
  );
  return external ? (
    <a className="quick" href={href} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <Link className="quick" href={href}>
      {inner}
    </Link>
  );
}

function Metric({ href, label, value, tone, icon }: { href: string; label: string; value: React.ReactNode; tone?: "warning"; icon: React.ReactNode }) {
  return (
    <Link href={href} className={`metric${tone ? ` metric--${tone}` : ""}`}>
      <span className="metric__icon" aria-hidden>
        {icon}
      </span>
      <span className="metric__value">{value}</span>
      <span className="metric__label">{label}</span>
    </Link>
  );
}

export function TodayPage() {
  const { gymId, base, gym, isOwner } = useAdmin();
  const { session } = useSession();
  const { data, error, loading, reload } = useApi<Dashboard>(`/gyms/${gymId}/dashboard`);
  const [tab, setTab] = useState<AttentionTab>("waiting");
  const first = session?.user?.name.split(" ")[0] ?? "there";

  if (error && !data) {
    return (
      <div className="page">
        <ErrorState message={error.message} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="page today">
      <section className="hero-card today__hero enter">
        <div>
          <p className="hero-card__eyebrow">{data ? formatDate(data.today) : " "}</p>
          <h1>
            {greeting()}, <em>{first}</em>
          </h1>
        </div>
        {loading && !data ? (
          <Skeleton height={56} radius={12} style={{ opacity: 0.2 }} />
        ) : (
          data && (
            <>
              {isOwner && data.collectionToday && (
                <div className="today__headline">
                  <span className="today__big">
                    <CountUp value={data.collectionToday.totalPaise} format={formatRupees} />
                  </span>
                  <span className="today__big-label">collected today · {data.collectionToday.count} payments</span>
                </div>
              )}
              <div className="today__strip">
                <Link href={`${base}/members?filter=active`}>
                  <strong>
                    <CountUp value={data.counts.active} />
                  </strong>
                  <span>Active</span>
                </Link>
                <Link href={`${base}/members?filter=expiring`}>
                  <strong className={data.counts.expiringSoon ? "is-hot" : undefined}>
                    <CountUp value={data.counts.expiringSoon} />
                  </strong>
                  <span>Expiring</span>
                </Link>
                <Link href={`${base}/members?filter=dues`}>
                  <strong className={data.duesTotalPaise ? "is-hot" : undefined}>
                    <CountUp value={data.duesTotalPaise} format={formatRupees} />
                  </strong>
                  <span>Dues</span>
                </Link>
              </div>
            </>
          )
        )}
      </section>

      <nav className="quick-row enter-stagger" aria-label="Quick actions">
        <QuickAction href={`${base}/followups`} label="Follow-ups" icon={<FiPhoneCall />} badge={data?.counts.openFollowups} />
        <QuickAction href={`${base}/members`} label="Members" icon={<FiUsers />} />
        {gym.checkinEnabled ? (
          <QuickAction href={`${base}/checkins`} label="Check-in" icon={<FiCheckSquare />} badge={data?.counts.checkinsToday} />
        ) : (
          <QuickAction href={`${base}/plans`} label="Plans" icon={<FiLayers />} />
        )}
        <QuickAction href={`/poster/${gym.slug}`} label="Gym QR" icon={<FiGrid />} external />
      </nav>

      <InstallBanner text="Keep the desk one tap away on your phone." />

      {loading && !data ? (
        <div className="card card--pad" style={{ display: "grid", gap: 12 }}>
          <Skeleton height={40} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      ) : (
        data && (
          <div className="two-col">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section className="section">
                <div className="section__head">
                  <span className="section__title">Needs attention</span>
                </div>
                <div className="segmented" role="tablist" aria-label="Needs attention">
                  <button type="button" role="tab" aria-selected={tab === "waiting"} aria-pressed={tab === "waiting"} onClick={() => setTab("waiting")}>
                    Waiting · {data.counts.pending}
                  </button>
                  <button type="button" role="tab" aria-selected={tab === "expiring"} aria-pressed={tab === "expiring"} onClick={() => setTab("expiring")}>
                    Expiring · {data.counts.expiringSoon}
                  </button>
                </div>
                <div className="card" key={tab}>
                  {tab === "waiting" ? (
                    data.pending.length === 0 ? (
                      <EmptyState icon={<FiInbox />} title="No one waiting" text="New sign-ups from the QR code show up here." />
                    ) : (
                      <div className="list enter-stagger">
                        {data.pending.map((m) => (
                          <MemberRow key={m.id} member={m} href={`${base}/members/${m.id}`} />
                        ))}
                      </div>
                    )
                  ) : data.expiringSoon.length === 0 ? (
                    <EmptyState icon={<FiCheckCircle />} title="Nothing expiring" text="Members whose plan ends in the next 7 days show up here." />
                  ) : (
                    <div className="list enter-stagger">
                      {data.expiringSoon.map((m) => (
                        <MemberRow key={m.id} member={m} href={`${base}/members/${m.id}`} />
                      ))}
                    </div>
                  )}
                </div>
                {(tab === "waiting" ? data.counts.pending > data.pending.length : data.counts.expiringSoon > data.expiringSoon.length) && (
                  <Link href={`${base}/members?filter=${tab === "waiting" ? "pending" : "expiring"}`} className="see-all">
                    See all
                  </Link>
                )}
              </section>

              <div className="metrics">
                <Metric href={`${base}/members?filter=grace`} label="In grace" value={<CountUp value={data.counts.grace} />} tone={data.counts.grace ? "warning" : undefined} icon={<FiAlertTriangle />} />
                <Metric href={`${base}/members?filter=expired`} label="Expired" value={<CountUp value={data.counts.expired} />} icon={<FiClock />} />
                <Metric href={`${base}/members?filter=dues`} label="With dues" value={<CountUp value={data.counts.withDues} />} tone={data.counts.withDues ? "warning" : undefined} icon={<RupeeIcon />} />
              </div>
            </div>

            {isOwner && data.collectionToday && (
              <section className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="section__title">Collected today</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    This month {formatRupees(data.collectionMonthPaise ?? 0)}
                  </span>
                </div>
                <span className="stat__value">{formatRupees(data.collectionToday.totalPaise)}</span>
                <div className="mode-bars">
                  {(Object.keys(MODE_LABEL) as (keyof typeof MODE_LABEL)[]).map((m) => {
                    const amount = data.collectionToday!.byMode[m];
                    const share = data.collectionToday!.totalPaise ? amount / data.collectionToday!.totalPaise : 0;
                    return (
                      <div key={m} className="mode-bar">
                        <span className="mode-bar__label">{MODE_LABEL[m]}</span>
                        <span className="mode-bar__track">
                          <span className="mode-bar__fill" style={{ width: `${Math.round(share * 100)}%` }} />
                        </span>
                        <span className="mode-bar__value tabular">{formatRupees(amount)}</span>
                      </div>
                    );
                  })}
                </div>
                {data.collectionToday.byStaff.length > 0 && (
                  <>
                    <hr className="divider" />
                    <dl className="kv">
                      {data.collectionToday.byStaff.map((s) => (
                        <div key={s.name} style={{ display: "contents" }}>
                          <dt>{s.name}</dt>
                          <dd className="tabular">
                            {formatRupees(s.totalPaise)} · {s.count}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </section>
            )}
          </div>
        )
      )}
    </div>
  );
}
