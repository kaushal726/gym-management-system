/* One member at the desk: where they stand, what they owe, and every action the desk can take. */
import { useState } from "react";
import { PiArrowLeftBold, PiArrowsClockwiseBold, PiCheckSquareBold, PiDotsThreeBold, PiLightningBold, PiPencilSimpleBold, PiPhoneBold, PiPlayCircleBold, PiWalletBold, PiWhatsappLogoBold } from "react-icons/pi";
import type { MemberDetail, Payment, Subscription } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { callLink, formatMobile, whatsappLink } from "../../../../shared/phone.ts";
import { formatDate, formatDateTime } from "../../lib/format.ts";
import { Link, navigate, useQueryParam } from "../../lib/router.tsx";
import { STATUS_LABEL, STATUS_TONE } from "../../lib/states.ts";
import { useApi } from "../../lib/useApi.ts";
import { Button, ButtonLink } from "../../components/ui/Button.tsx";
import { Avatar, Badge, ErrorState, Notice, Skeleton, StateBadge } from "../../components/ui/Feedback.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { FreezeList, PaymentList, SubscriptionList } from "../member/MemberSections.tsx";
import { useAdmin } from "./AdminShell.tsx";
import { ActivateSheet } from "./ActivateSheet.tsx";
import { CancelSheet, FreezeSheet, PaymentSheet } from "./PlanActionSheets.tsx";
import { MemberFormSheet } from "./MemberFormSheet.tsx";
import { MemberMoreSheet } from "./MemberMoreSheet.tsx";
import { PaymentDetailSheet, SubscriptionDetailSheet } from "./RecordSheets.tsx";
import { EditPlanSheet } from "./EditPlanSheet.tsx";

type Open =
  | { kind: "activate"; plan: "MEMBERSHIP" | "PT" }
  | { kind: "pay" | "freeze" | "cancel" | "editPlan" | "sub"; sub: Subscription }
  | { kind: "payment"; payment: Payment }
  | { kind: "edit" | "more" }
  | null;

export function MemberDetailPage({ memberId }: { memberId: string }) {
  const { gymId, base, isOwner } = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<MemberDetail>(`/gyms/${gymId}/members/${memberId}`);
  const autoActivate = useQueryParam("activate") === "1";
  const [open, setOpen] = useState<Open>(autoActivate ? { kind: "activate", plan: "MEMBERSHIP" } : null);
  const close = () => {
    setOpen(null);
    if (autoActivate) navigate(`${base}/members/${memberId}`, { replace: true });
  };
  const done = (message: string) => {
    close();
    toast(message);
    reload();
  };

  if (error && !data) {
    return (
      <div className="page">
        <ErrorState message={error.message} onRetry={reload} />
      </div>
    );
  }
  if (loading && !data) {
    return (
      <div className="page">
        <Skeleton width={180} height={28} />
        <Skeleton height={140} radius={12} />
        <Skeleton height={220} radius={12} />
      </div>
    );
  }
  if (!data) return null;

  const { member, membership, pt } = data;
  const pending = member.status === "PENDING" || member.status === "LEAD";
  const dueSub = data.subscriptions.find((s) => s.duePaise > 0) ?? null;
  const running = membership.state === "ACTIVE" || membership.state === "FROZEN" ? membership.current : null;
  const chainEnd = data.subscriptions.filter((s) => s.kind === "MEMBERSHIP" && !s.cancelledAt).reduce<string | null>((m, s) => (m == null || s.endDate > m ? s.endDate : m), null);
  const archived = member.archivedAt != null;
  const rejected = member.status === "REJECTED";

  return (
    <div className="page">
      <Link href={`${base}/members`} className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, minHeight: 32 }}>
        <PiArrowLeftBold aria-hidden /> Members
      </Link>

      <div className="card card--pad enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar name={member.name} src={member.pictureUrl} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ overflowWrap: "anywhere" }}>{member.name}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
              {member.status === "JOINED" ? <StateBadge state={membership.state} /> : <Badge tone={STATUS_TONE[member.status]}>{STATUS_LABEL[member.status]}</Badge>}
              {archived && <Badge>Archived</Badge>}
              {(pt.state === "ACTIVE" || pt.state === "FROZEN") && <Badge tone="accent">PT</Badge>}
              {member.linkedEmail ? <Badge tone="neutral">App linked</Badge> : null}
              <span className="muted tabular" style={{ fontSize: 14 }}>
                {formatMobile(member.phone)}
              </span>
            </div>
          </div>
        </div>

        {pending && <Notice tone="info">{member.source === "QR" ? `Signed up from the QR code${member.requestNo ? ` · request #${member.requestNo}` : ""}.` : "Added at the desk."} Pick a plan and take the payment to make them a member.</Notice>}
        {rejected && <Notice tone="danger">Rejected: {member.rejectedReason}</Notice>}
        {archived && <Notice tone="warning">Archived: {member.archivedReason}. No reminders go out.</Notice>}

        {member.status === "JOINED" && (
          <dl className="kv">
            <dt>Plan</dt>
            <dd>{membership.current?.planName ?? membership.upcoming?.planName ?? "None"}</dd>
            <dt>{membership.state === "GRACE" || membership.state === "EXPIRED" ? "Ended on" : "Valid till"}</dt>
            <dd>{formatDate(chainEnd)}</dd>
            {membership.upcoming && running && (
              <>
                <dt>Renewed</dt>
                <dd>
                  {membership.upcoming.planName} from {formatDate(membership.upcoming.startDate)}
                </dd>
              </>
            )}
            <dt>Dues</dt>
            <dd className="tabular" style={{ color: data.duesTotalPaise ? "var(--warning)" : undefined, fontWeight: 700 }}>
              {formatRupees(data.duesTotalPaise)}
            </dd>
          </dl>
        )}

        {!rejected && !archived && (
          <div className="detail-actions">
            <div className="detail-actions__main">
              <Button variant="primary" icon={pending || member.status !== "JOINED" ? <PiPlayCircleBold /> : <PiArrowsClockwiseBold />} onClick={() => setOpen({ kind: "activate", plan: "MEMBERSHIP" })}>
                {pending ? "Activate" : data.isFirstSubscription ? "Start plan" : "Renew"}
              </Button>
              {dueSub && (
                <Button icon={<PiWalletBold />} onClick={() => setOpen({ kind: "pay", sub: dueSub })}>
                  Take {formatRupees(dueSub.duePaise)}
                </Button>
              )}
            </div>
            <div className="detail-actions__quick">
              <ButtonLink href={whatsappLink(member.phone, `Hi ${member.name.split(" ")[0]},`)} external icon={<PiWhatsappLogoBold />}>
                WhatsApp
              </ButtonLink>
              <ButtonLink href={callLink(member.phone)} external icon={<PiPhoneBold />}>
                Call
              </ButtonLink>
              <Button icon={<PiDotsThreeBold />} onClick={() => setOpen({ kind: "more" })}>
                More
              </Button>
            </div>
          </div>
        )}
        {(rejected || archived) && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon={<PiDotsThreeBold />} onClick={() => setOpen({ kind: "more" })}>
              Options
            </Button>
          </div>
        )}
      </div>

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card">
            <div className="card__head">
              <span className="section__title">Plans</span>
              {member.status === "JOINED" && !archived && (
                <Button size="sm" variant="ghost" icon={<PiLightningBold />} onClick={() => setOpen({ kind: "activate", plan: "PT" })}>
                  Add PT
                </Button>
              )}
            </div>
            <SubscriptionList subscriptions={data.subscriptions} today={data.today} onSelect={(sub) => setOpen({ kind: "sub", sub })} />
          </section>
          <section className="card">
            <div className="card__head">
              <span className="section__title">Payments</span>
            </div>
            <PaymentList payments={data.payments} onSelect={(payment) => setOpen({ kind: "payment", payment })} />
          </section>
          {data.freezes.length > 0 && (
            <section className="card">
              <div className="card__head">
                <span className="section__title">Freezes</span>
              </div>
              <FreezeList freezes={data.freezes} />
            </section>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card">
            <div className="card__head">
              <span className="section__title">Details</span>
              <Button size="sm" variant="ghost" icon={<PiPencilSimpleBold />} onClick={() => setOpen({ kind: "edit" })}>
                Edit
              </Button>
            </div>
            <div className="card__body">
              <dl className="kv">
                <dt>Mobile</dt>
                <dd className="tabular">{formatMobile(member.phone)}</dd>
                <dt>Born</dt>
                <dd>{formatDate(member.dob)}</dd>
                <dt>Emergency</dt>
                <dd>{member.emergencyName ? `${member.emergencyName}${member.emergencyPhone ? ` · ${formatMobile(member.emergencyPhone)}` : ""}` : "—"}</dd>
                {member.guardianName && (
                  <>
                    <dt>Guardian</dt>
                    <dd>
                      {member.guardianName} · {formatMobile(member.guardianPhone ?? "")}
                    </dd>
                  </>
                )}
                <dt>Google</dt>
                <dd>{member.linkedEmail ?? (member.inviteEmail ? `${member.inviteEmail} · not signed in yet` : "Not linked")}</dd>
                <dt>Joined via</dt>
                <dd>{member.source === "QR" ? "QR sign-up" : "Desk"}</dd>
                <dt>Added</dt>
                <dd>{formatDateTime(member.createdAt)}</dd>
              </dl>
            </div>
          </section>
          {data.visits.length > 0 && (
            <section className="card">
              <div className="card__head">
                <span className="section__title">Recent visits</span>
              </div>
              <div className="list">
                {data.visits.slice(0, 8).map((v) => (
                  <div className="list-row" key={v.id} style={{ minHeight: 48 }}>
                    <PiCheckSquareBold aria-hidden className="muted" />
                    <span className="list-row__main">{formatDateTime(v.at)}</span>
                    <StateBadge state={v.result} />
                  </div>
                ))}
              </div>
            </section>
          )}
          {data.phoneHistory.length > 0 && (
            <section className="card">
              <div className="card__head">
                <span className="section__title">Number changes</span>
              </div>
              <div className="card__body">
                <dl className="kv">
                  {data.phoneHistory.map((h) => (
                    <div key={h.changedAt} style={{ display: "contents" }}>
                      <dt>{formatDate(h.changedAt.slice(0, 10))}</dt>
                      <dd className="tabular">
                        {formatMobile(h.oldPhone)} → {formatMobile(h.newPhone)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          )}
        </div>
      </div>

      {open?.kind === "activate" && <ActivateSheet open detail={data} kind={open.plan} onClose={close} onDone={() => done(pending ? "Member activated" : "Plan saved")} />}
      <PaymentSheet open={open?.kind === "pay"} gymId={gymId} sub={open?.kind === "pay" ? open.sub : null} onClose={close} onDone={done} />
      <FreezeSheet open={open?.kind === "freeze"} gymId={gymId} sub={open?.kind === "freeze" ? open.sub : null} today={data.today} isOwner={isOwner} onClose={close} onDone={done} />
      <CancelSheet open={open?.kind === "cancel"} gymId={gymId} sub={open?.kind === "cancel" ? open.sub : null} today={data.today} onClose={close} onDone={done} />
      {isOwner && <EditPlanSheet open={open?.kind === "editPlan"} gymId={gymId} sub={open?.kind === "editPlan" ? open.sub : null} onClose={close} onDone={done} />}
      <SubscriptionDetailSheet
        open={open?.kind === "sub"}
        sub={open?.kind === "sub" ? open.sub : null}
        today={data.today}
        isOwner={isOwner}
        onClose={close}
        onAction={(action, sub) => setOpen({ kind: action, sub })}
      />
      <PaymentDetailSheet open={open?.kind === "payment"} payment={open?.kind === "payment" ? open.payment : null} gymId={gymId} isOwner={isOwner} onClose={close} onDone={done} />
      <MemberFormSheet open={open?.kind === "edit"} gymId={gymId} today={data.today} member={member} onClose={close} onSaved={() => done("Details saved")} />
      <MemberMoreSheet open={open?.kind === "more"} detail={data} onClose={close} onDone={done} />
    </div>
  );
}

