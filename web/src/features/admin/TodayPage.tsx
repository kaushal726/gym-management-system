/* Today: the four numbers that matter, what's waiting at the desk, who expires this week and today's cash. */
import { FiAlertTriangle, FiCheckCircle, FiClock, FiInbox, FiPhoneCall, FiUsers } from "react-icons/fi";
import type { Dashboard } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { formatDate } from "../../lib/format.ts";
import { Link } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { MODE_LABEL } from "../../lib/states.ts";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback.tsx";
import { InstallBanner } from "../../components/ui/InstallBanner.tsx";
import { useAdmin } from "./AdminShell.tsx";
import { RupeeIcon } from "../../components/ui/RupeeIcon.tsx";
import { CountUp } from "../../components/ui/CountUp.tsx";
import { MemberRow } from "./MemberRow.tsx";

function Stat({ href, label, value, hint, icon, tone }: { href: string; label: string; value: React.ReactNode; hint?: string; icon: React.ReactNode; tone?: string }) {
  return (
    <Link href={href} className="stat">
      <span className="stat__label">
        {icon}
        {label}
      </span>
      <span className="stat__value" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      {hint && <span className="stat__hint">{hint}</span>}
    </Link>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function TodayPage() {
  const { gymId, base, gym, isOwner } = useAdmin();
  const { session } = useSession();
  const { data, error, loading, reload } = useApi<Dashboard>(`/gyms/${gymId}/dashboard`);

  return (
    <div className="page">
      <section className="hero-card enter">
        <div className="hero-card__text">
          <p className="hero-card__eyebrow">{data ? formatDate(data.today) : " "}</p>
          <h1>
            {greeting()}, <em>{session?.user?.name.split(" ")[0] ?? "there"}</em>
          </h1>
          {isOwner && data?.collectionToday ? (
            <p className="hero-card__sub">
              <CountUp value={data.collectionToday.totalPaise} format={formatRupees} /> collected today
            </p>
          ) : (
            <p className="hero-card__sub">{data ? `${data.counts.active} active members · ${data.counts.pending} waiting at the desk` : gym.name}</p>
          )}
        </div>
      </section>

      <InstallBanner text="Keep the desk one tap away on your phone." />

      {error && !data ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <div className="stats">
          {[0, 1, 2, 3].map((i) => (
            <div className="stat" key={i}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={34} style={{ marginTop: 6 }} />
            </div>
          ))}
        </div>
      ) : (
        data && (
          <>
            <div className="stats enter-stagger">
              <Stat href={`${base}/members?filter=active`} label="Active" value={<CountUp value={data.counts.active} />} hint={data.counts.frozen ? `${data.counts.frozen} frozen` : undefined} icon={<FiUsers />} />
              <Stat href={`${base}/members?filter=expiring`} label="Expiring in 7 days" value={<CountUp value={data.counts.expiringSoon} />} icon={<FiClock />} tone={data.counts.expiringSoon ? "var(--warning)" : undefined} />
              <Stat
                href={`${base}/members?filter=grace`}
                label="In grace"
                value={<CountUp value={data.counts.grace} />}
                hint={`${data.counts.expired} expired`}
                icon={<FiAlertTriangle />}
                tone={data.counts.grace ? "var(--warning)" : undefined}
              />
              <Stat href={`${base}/members?filter=dues`} label="Dues" value={<CountUp value={data.duesTotalPaise} format={formatRupees} />} hint={`${data.counts.withDues} members`} icon={<RupeeIcon />} tone={data.duesTotalPaise ? "var(--warning)" : undefined} />
            </div>

            <div className="two-col">
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <section className="section">
                  <div className="section__head">
                    <span className="section__title">Waiting at the desk · {data.counts.pending}</span>
                    {data.counts.pending > data.pending.length && <Link href={`${base}/members?filter=pending`}>See all</Link>}
                  </div>
                  <div className="card">
                    {data.pending.length === 0 ? (
                      <EmptyState icon={<FiInbox />} title="No one waiting" text="New sign-ups from the QR code show up here." />
                    ) : (
                      <div className="list">
                        {data.pending.map((m) => (
                          <MemberRow key={m.id} member={m} href={`${base}/members/${m.id}`} />
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="section">
                  <div className="section__head">
                    <span className="section__title">Expiring this week · {data.counts.expiringSoon}</span>
                    {data.counts.expiringSoon > data.expiringSoon.length && <Link href={`${base}/members?filter=expiring`}>See all</Link>}
                  </div>
                  <div className="card">
                    {data.expiringSoon.length === 0 ? (
                      <EmptyState icon={<FiCheckCircle />} title="Nothing expiring" text="Members whose plan ends in the next 7 days show up here." />
                    ) : (
                      <div className="list">
                        {data.expiringSoon.map((m) => (
                          <MemberRow key={m.id} member={m} href={`${base}/members/${m.id}`} />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Link href={`${base}/followups`} className="stat" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <span className="state-box__icon" style={{ width: 40, height: 40, background: "var(--accent-soft)", color: "var(--accent-soft-text)" }} aria-hidden>
                    <FiPhoneCall />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontWeight: 650 }}>Follow-ups</span>
                    <span className="stat__hint">Renewals and dues to call or WhatsApp</span>
                  </span>
                  <span className="stat__value" style={{ fontSize: 28 }}>
                    {data.counts.openFollowups}
                  </span>
                </Link>

                {gym.checkinEnabled && (
                  <Link href={`${base}/checkins`} className="stat" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <span className="state-box__icon" style={{ width: 40, height: 40 }} aria-hidden>
                      <FiCheckCircle />
                    </span>
                    <span style={{ flex: 1, fontWeight: 650 }}>Check-ins today</span>
                    <span className="stat__value" style={{ fontSize: 28 }}>
                      {data.counts.checkinsToday}
                    </span>
                  </Link>
                )}

                {isOwner && data.collectionToday && (
                  <section className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span className="section__title">Collected today</span>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Month {formatRupees(data.collectionMonthPaise ?? 0)}
                      </span>
                    </div>
                    <span className="stat__value"><CountUp value={data.collectionToday.totalPaise} format={formatRupees} /></span>
                    <dl className="kv">
                      {(Object.keys(MODE_LABEL) as (keyof typeof MODE_LABEL)[]).map((m) => (
                        <div key={m} style={{ display: "contents" }}>
                          <dt>{MODE_LABEL[m]}</dt>
                          <dd className="tabular">{formatRupees(data.collectionToday!.byMode[m])}</dd>
                        </div>
                      ))}
                    </dl>
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
            </div>
          </>
        )
      )}
    </div>
  );
}
