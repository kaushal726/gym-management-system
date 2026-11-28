/* /platform/gyms/:id/owner-view — what the gym's owner sees, read-only, for the platform admin: the gym's numbers, its
 * member list, plans and settings. Nothing can be changed from here. */
import { PiArrowLeftBold, PiEyeBold } from "react-icons/pi";
import type { GymOverview, Plan, PlatformGymDetail } from "../../../../shared/api.ts";
import { BATCH_LABEL } from "../../../../shared/constants.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { formatDate } from "../../lib/format.ts";
import { Link } from "../../lib/router.tsx";
import { MODE_LABEL } from "../../lib/states.ts";
import { useApi } from "../../lib/useApi.ts";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { Badge, ErrorState, Skeleton } from "../../components/ui/Feedback.tsx";
import { CountUp } from "../../components/ui/CountUp.tsx";
import { GymMembersCard } from "./GymMembersCard.tsx";

function planLength(p: Plan): string {
  if (p.durationMonths) return `${p.durationMonths} month${p.durationMonths === 1 ? "" : "s"}`;
  return `${p.durationDays} days`;
}

function Tile({ label, value, hot }: { label: string; value: string | number; hot?: boolean }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value" style={{ color: hot ? "var(--warning)" : undefined }}>
        {value}
      </span>
    </div>
  );
}

export function GymOverviewPage({ gymId }: { gymId: string }) {
  const overview = useApi<GymOverview>(`/platform/gyms/${gymId}/overview`);
  const detail = useApi<PlatformGymDetail>(`/platform/gyms/${gymId}`);
  const gymName = detail.data?.gym.name ?? "Gym";
  const back = (
    <Link href={`/platform/gyms/${gymId}`} className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, minHeight: 32 }}>
      <PiArrowLeftBold aria-hidden /> {gymName}
    </Link>
  );
  const { data, error, loading, reload } = overview;

  if (error && !data) {
    return (
      <NarrowLayout title="Platform console" wide>
        {back}
        <ErrorState message={error.message} onRetry={reload} />
      </NarrowLayout>
    );
  }
  if (loading && !data) {
    return (
      <NarrowLayout title="Platform console" wide>
        {back}
        <Skeleton height={180} radius={16} />
        <Skeleton height={120} radius={12} />
      </NarrowLayout>
    );
  }
  if (!data) return null;
  const { counts, settings } = data;

  return (
    <NarrowLayout title="Platform console" wide>
      {back}
      <section className="hero-card today__hero enter">
        <div>
          <p className="hero-card__eyebrow">{formatDate(data.today)}</p>
          <h1>
            <em>{gymName}</em>
          </h1>
        </div>
        <div className="today__headline">
          <span className="today__big">
            <CountUp value={counts.active} />
          </span>
          <span className="today__big-label">active members</span>
        </div>
        <div className="today__strip">
          <div>
            <strong className={counts.expiringSoon ? "is-hot" : undefined}>
              <CountUp value={counts.expiringSoon} />
            </strong>
            <span>Expiring</span>
          </div>
          <div>
            <strong className={data.duesTotalPaise ? "is-hot" : undefined}>
              <CountUp value={data.duesTotalPaise} format={formatRupees} />
            </strong>
            <span>Dues</span>
          </div>
          <div>
            <strong>
              <CountUp value={data.collectedTodayPaise} format={formatRupees} />
            </strong>
            <span>Today</span>
          </div>
        </div>
      </section>

      <div className="stats enter-stagger">
        <Tile label="In grace" value={counts.grace} hot={counts.grace > 0} />
        <Tile label="Expired" value={counts.expired} hot={counts.expired > 0} />
        <Tile label="Frozen" value={counts.frozen} />
        <Tile label="Waiting at desk" value={counts.pending} />
        <Tile label="With dues" value={counts.withDues} hot={counts.withDues > 0} />
      </div>

      <GymMembersCard gymId={gymId} />

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card">
            <div className="card__head">
              <span className="section__title">Collected</span>
            </div>
            <div className="card__body">
              <dl className="kv">
                <dt>Today</dt>
                <dd>{formatRupees(data.collectedTodayPaise)}</dd>
                {(["CASH", "UPI", "CARD"] as const).map((mode) => (
                  <div key={mode} style={{ display: "contents" }}>
                    <dt>· {MODE_LABEL[mode]}</dt>
                    <dd>{formatRupees(data.collectedTodayByMode[mode])}</dd>
                  </div>
                ))}
                <dt>This month</dt>
                <dd>{formatRupees(data.collectedMonthPaise)}</dd>
              </dl>
            </div>
          </section>
          <section className="card">
            <div className="card__head">
              <span className="section__title">Plans</span>
            </div>
            {data.plans.length === 0 ? (
              <div className="card__body muted">No plans yet.</div>
            ) : (
              <div className="list">
                {data.plans.map((p) => (
                  <div className="list-row" key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                    <span className="list-row__main">
                      <span className="list-row__title">{p.name}</span>
                      <span className="list-row__sub">
                        {planLength(p)}
                        {p.maxFreezeDays ? ` · ${p.maxFreezeDays} freeze days` : ""}
                      </span>
                    </span>
                    <span className="list-row__end">
                      <span className="tabular" style={{ fontWeight: 700 }}>
                        {formatRupees(p.pricePaise)}
                      </span>
                      {!p.active && <Badge>Hidden</Badge>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="card">
          <div className="card__head">
            <span className="section__title">
              <PiEyeBold aria-hidden /> Gym settings
            </span>
          </div>
          <div className="card__body">
            <dl className="kv">
              <dt>Desk phone</dt>
              <dd>{settings.phone ?? "—"}</dd>
              <dt>UPI ID</dt>
              <dd>{settings.upiId ?? "—"}</dd>
              <dt>Address</dt>
              <dd>{settings.address ?? "—"}</dd>
              <dt>Grace days</dt>
              <dd>{settings.graceDays}</dd>
              <dt>Joining fee</dt>
              <dd>{formatRupees(settings.joiningFeePaise)}</dd>
              <dt>Batches</dt>
              <dd>{settings.batches.map((b) => BATCH_LABEL[b]).join(", ")}</dd>
              <dt>Check-in</dt>
              <dd>{settings.checkinEnabled ? "On" : "Off"}</dd>
            </dl>
          </div>
        </section>
      </div>
    </NarrowLayout>
  );
}
