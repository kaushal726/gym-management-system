/* /me and /me/:gymId — the member's own page: a welcome, plan, days left, dues, receipts, history, and their own details to edit. */
import { useState } from "react";
import { PiPencilSimpleBold, PiPhoneBold, PiUserPlusDuotone, PiWhatsappLogoBold } from "react-icons/pi";
import type { MeMembership, MemberProfile } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { callLink, formatMobile, whatsappLink } from "../../../../shared/phone.ts";
import { useGymBrand } from "../../lib/brand.ts";
import { formatDate } from "../../lib/format.ts";
import { navigate, Redirect } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { Button, ButtonLink } from "../../components/ui/Button.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { MemberFormSheet } from "../admin/MemberFormSheet.tsx";
import { GymHero } from "./GymHero.tsx";
import { EmptyState, ErrorState, Notice, Skeleton } from "../../components/ui/Feedback.tsx";
import { Qr, upiLink } from "../../components/ui/Qr.tsx";
import { FreezeList, MembershipHero, PaymentList, SubscriptionList, VisitSummary } from "./MemberSections.tsx";
import { PushCard, usePush } from "./PushCard.tsx";
import { BATCH_LABEL } from "../../../../shared/constants.ts";
import { InstallBanner } from "../../components/ui/InstallBanner.tsx";

export function MemberPage({ gymId }: { gymId?: string }) {
  const { session } = useSession();
  const gyms = session?.memberOf ?? [];
  if (gyms.length === 0) {
    return (
      <NarrowLayout title="My membership" hero={<GymHero firstName={firstNameOf(session?.user?.name)} />}>
        <EmptyState icon={<PiUserPlusDuotone />} title="No membership yet" text="Scan the QR code at your gym's desk to join. If the desk added you, ask them for a link on WhatsApp." />
      </NarrowLayout>
    );
  }
  const selected = gyms.find((g) => g.gymId === gymId);
  if (!selected) return <Redirect to={`/me/${gyms[0].gymId}`} />;
  return <MemberView gymId={selected.gymId} />;
}

function firstNameOf(name: string | undefined): string {
  return name?.split(" ")[0] || "there";
}

/** The gym's address and the member's batch, as the hero's small print. */
function heroInfo(address: string | null, batch: MemberProfile["batch"]): string[] {
  return [address, batch ? `${BATCH_LABEL[batch]} batch` : null].filter((x): x is string => !!x);
}

function MemberView({ gymId }: { gymId: string }) {
  const { session } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<MeMembership>(`/public/me/gyms/${gymId}`);
  const [editing, setEditing] = useState(false);
  const push = usePush();
  useGymBrand(data?.gym.id);
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
      <NarrowLayout title="My membership" hero={<GymHero firstName={firstNameOf(session?.user?.name)} switcher={switcher} />}>
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
      <NarrowLayout title="My membership" hero={<GymHero firstName={firstNameOf(session?.user?.name)} switcher={switcher} />}>
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
    <NarrowLayout title={gym.name} hero={<GymHero firstName={firstNameOf(member.name)} gymName={gym.name} info={heroInfo(gym.address, member.batch)} switcher={switcher} />} wide>
      <div className="member-grid">
        <div className="member-grid__side">
          {pending ? (
            <div className="card card--pad form-grid">
              <Notice tone="info">Your request is with the desk. They will start your plan when you pay.</Notice>
              <ButtonLink href={`/g/${gym.slug}`} variant="primary" block>
                Show my request
              </ButtonLink>
            </div>
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
          {push.status !== "on" && <PushCard push={push} />}
        </div>
        <div className="member-grid__main">
          <section className="card">
            <div className="card__head">
              <span className="section__title">Receipts</span>
            </div>
            <PaymentList payments={data.payments} />
          </section>

          <section className="card">
            <div className="card__head">
              <span className="section__title">Plans</span>
            </div>
            <SubscriptionList subscriptions={data.subscriptions} today={data.today} />
          </section>

          {data.freezes.length > 0 && (
            <section className="card">
              <div className="card__head">
                <span className="section__title">Freezes</span>
              </div>
              <FreezeList freezes={data.freezes} />
            </section>
          )}

          <section className="card">
            <div className="card__head">
              <span className="section__title">My details</span>
              <Button size="sm" variant="ghost" icon={<PiPencilSimpleBold />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
            <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <dl className="kv">
                <dt>Name</dt>
                <dd>{member.name}</dd>
                <dt>Mobile</dt>
                <dd className="tabular">{formatMobile(member.phone)}</dd>
                {member.batch && (
                  <>
                    <dt>Batch</dt>
                    <dd>{BATCH_LABEL[member.batch]}</dd>
                  </>
                )}
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
                Your Gmail can only be changed by the gym.
              </p>
            </div>
          </section>

          {gym.phone && (
            <section className="card">
              <div className="card__head">
                <span className="section__title">Need help?</span>
              </div>
              <div className="card__body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <ButtonLink href={whatsappLink(gym.phone.replace(/\D/g, "").slice(-10), `Hi ${gym.name}, this is ${member.name}.`)} external icon={<PiWhatsappLogoBold />}>
                  WhatsApp the desk
                </ButtonLink>
                <ButtonLink href={callLink(gym.phone.replace(/\D/g, "").slice(-10))} external icon={<PiPhoneBold />}>
                  Call the desk
                </ButtonLink>
              </div>
            </section>
          )}
        </div>
      </div>
      {push.status === "on" && <PushCard push={push} quiet />}
      <MemberFormSheet
        open={editing}
        gymId={gym.id}
        today={data.today}
        member={member}
        batches={gym.batches}
        selfEdit
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          toast("Details saved");
          reload();
        }}
      />
    </NarrowLayout>
  );
}
