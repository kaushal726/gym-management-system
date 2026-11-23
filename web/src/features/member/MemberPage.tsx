/* /me and /me/:gymId — the member's own page. View only: plan, days left, dues, receipts, history. */
import { FiMessageCircle, FiPhone, FiUserPlus } from "react-icons/fi";
import type { MeMembership } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { callLink, formatMobile, whatsappLink } from "../../../../shared/phone.ts";
import { formatDate } from "../../lib/format.ts";
import { navigate, Redirect } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { ButtonLink } from "../../components/ui/Button.tsx";
import { EmptyState, ErrorState, Notice, Skeleton } from "../../components/ui/Feedback.tsx";
import { Qr, upiLink } from "../../components/ui/Qr.tsx";
import { FreezeList, MembershipHero, PaymentList, SubscriptionList, VisitSummary } from "./MemberSections.tsx";
import { PushCard } from "./PushCard.tsx";
import { InstallBanner } from "../../components/ui/InstallBanner.tsx";

export function MemberPage({ gymId }: { gymId?: string }) {
  const { session } = useSession();
  const gyms = session?.memberOf ?? [];
  if (gyms.length === 0) {
    return (
      <NarrowLayout title="My membership">
        <EmptyState icon={<FiUserPlus />} title="No membership yet" text="Scan the QR code at your gym's desk to join. If the desk added you, ask them for a link on WhatsApp." />
      </NarrowLayout>
    );
  }
  const selected = gyms.find((g) => g.gymId === gymId);
  if (!selected) return <Redirect to={`/me/${gyms[0].gymId}`} />;
  return <MemberView gymId={selected.gymId} />;
}

function MemberView({ gymId }: { gymId: string }) {
  const { session } = useSession();
  const { data, error, loading, reload } = useApi<MeMembership>(`/public/me/gyms/${gymId}`);
  const gyms = session?.memberOf ?? [];
  const switcher =
    gyms.length > 1 ? (
      <select className="input" style={{ width: "auto", minHeight: 36 }} value={gymId} onChange={(e) => navigate(`/me/${e.target.value}`)} aria-label="Choose gym">
        {gyms.map((g) => (
          <option key={g.gymId} value={g.gymId}>
            {g.gymName}
          </option>
        ))}
      </select>
    ) : undefined;

  if (loading && !data) {
    return (
      <NarrowLayout title="My membership" actions={switcher}>
        <div className="card card--pad" style={{ display: "grid", justifyItems: "center", gap: 16 }}>
          <Skeleton width={168} height={168} radius={84} />
          <Skeleton width="50%" height={20} />
        </div>
        <Skeleton height={120} radius={12} />
      </NarrowLayout>
    );
  }
  if (error || !data) {
    return (
      <NarrowLayout title="My membership" actions={switcher}>
        <ErrorState message={error?.message} onRetry={reload} />
      </NarrowLayout>
    );
  }

  const { gym, member, membership, pt } = data;
  const chainEnd = data.subscriptions
    .filter((s) => s.kind === "MEMBERSHIP" && !s.cancelledAt)
    .reduce<string | null>((max, s) => (max == null || s.endDate > max ? s.endDate : max), null);
  const pending = member.status === "PENDING" || member.status === "LEAD";

  return (
    <NarrowLayout title={gym.name} subtitle={`Hi, ${member.name.split(" ")[0]}`} actions={switcher} wide>
      <div className="member-grid">
        <div className="member-grid__side">
          {pending ? (
            <>
              <Notice tone="info">Your request is with the desk. They will start your plan when you pay.</Notice>
              <ButtonLink href={`/g/${gym.slug}`} variant="primary" block>
                Show my request
              </ButtonLink>
            </>
          ) : (
            <MembershipHero summary={membership} today={data.today} chainEnd={chainEnd} />
          )}

          {data.duesTotalPaise > 0 && (
            <div className="card card--pad enter" style={{ display: "flex", flexDirection: "column", gap: 12, borderColor: "var(--warning)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <h3>Payment pending</h3>
                <span className="stat__value" style={{ color: "var(--warning)" }}>
                  {formatRupees(data.duesTotalPaise)}
                </span>
              </div>
              {gym.upiId ? (
                <>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <Qr text={upiLink(gym.upiId, gym.name, data.duesTotalPaise)} size={120} label={`UPI QR to pay ${gym.name}`} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span className="muted" style={{ fontSize: 13 }}>
                        UPI ID
                      </span>
                      <span style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{gym.upiId}</span>
                      <a
                        className="btn btn--secondary btn--sm hide-desktop"
                        href={upiLink(gym.upiId, gym.name, data.duesTotalPaise)}
                        style={{ textDecoration: "none", marginTop: 4 }}
                      >
                        Pay with a UPI app
                      </a>
                    </div>
                  </div>
                  <p className="muted" style={{ fontSize: 13 }}>
                    After paying, show the payment screen at the desk so they can record it.
                  </p>
                </>
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>
                  Please clear it at the desk.
                </p>
              )}
            </div>
          )}

          {(pt.state === "ACTIVE" || pt.state === "FROZEN" || pt.state === "UPCOMING") && pt.current && (
            <div className="card card--pad" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3>{pt.current.planName}</h3>
                <p className="muted" style={{ fontSize: 13 }}>
                  {pt.current.trainerName ? `With ${pt.current.trainerName} · ` : ""}till {formatDate(pt.current.endDate)}
                </p>
              </div>
            </div>
          )}

          <InstallBanner text="See your plan and get reminders like an app." />
          {gym.checkinEnabled && <VisitSummary visits={data.visits} today={data.today} />}
          <PushCard />
        </div>
        <div className="member-grid__main">
          <section className="section">
            <div className="section__head">
              <span className="section__title">Receipts</span>
            </div>
            <div className="card">
              <PaymentList payments={data.payments} />
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <span className="section__title">Plans</span>
            </div>
            <div className="card">
              <SubscriptionList subscriptions={data.subscriptions} today={data.today} />
            </div>
          </section>

          {data.freezes.length > 0 && (
            <section className="section">
              <div className="section__head">
                <span className="section__title">Freezes</span>
              </div>
              <div className="card">
                <FreezeList freezes={data.freezes} />
              </div>
            </section>
          )}

          <section className="section">
            <div className="section__head">
              <span className="section__title">My details</span>
            </div>
            <div className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <dl className="kv">
                <dt>Name</dt>
                <dd>{member.name}</dd>
                <dt>Mobile</dt>
                <dd className="tabular">{formatMobile(member.phone)}</dd>
                {member.emergencyName && (
                  <>
                    <dt>Emergency</dt>
                    <dd>
                      {member.emergencyName}
                      {member.emergencyPhone ? ` · ${formatMobile(member.emergencyPhone)}` : ""}
                    </dd>
                  </>
                )}
              </dl>
              <p className="muted" style={{ fontSize: 13 }}>
                To change your details, please ask the desk.
              </p>
            </div>
          </section>

          {gym.phone && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <ButtonLink href={whatsappLink(gym.phone.replace(/\D/g, "").slice(-10), `Hi ${gym.name}, this is ${member.name}.`)} external icon={<FiMessageCircle />}>
                Message gym
              </ButtonLink>
              <ButtonLink href={callLink(gym.phone.replace(/\D/g, "").slice(-10))} external icon={<FiPhone />}>
                Call gym
              </ButtonLink>
            </div>
          )}
        </div>
      </div>
    </NarrowLayout>
  );
}
