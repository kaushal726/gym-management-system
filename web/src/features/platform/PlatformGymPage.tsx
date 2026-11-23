/* /platform/gyms/:id — one gym from the platform side: plan and valid-till, pause/resume, archive, owner,
 * details, team and health numbers. Never the gym's members' money. */
import { useState } from "react";
import { PiArchiveBold, PiArrowCounterClockwiseBold, PiArrowLeftBold, PiArrowSquareOutBold, PiPauseBold, PiPencilSimpleBold, PiPlayBold, PiUserCheckBold, PiWalletBold, PiWalletDuotone } from "react-icons/pi";
import type { PlatformGymDetail } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { GYM_ACCESS_LABEL, SAAS_GRACE_DAYS } from "../../../../shared/saas.ts";
import { formatDate, formatDateTime } from "../../lib/format.ts";
import { api } from "../../lib/api.ts";
import { Link } from "../../lib/router.tsx";
import { ROLE_LABEL } from "../../lib/states.ts";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { Button, ButtonLink } from "../../components/ui/Button.tsx";
import { Badge, EmptyState, ErrorState, Notice, Skeleton } from "../../components/ui/Feedback.tsx";
import { ReasonSheet } from "../../components/ui/ReasonSheet.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { ACCESS_TONE } from "./PlatformPage.tsx";
import { BillingSheet, DetailsSheet, OwnerSheet } from "./PlatformSheets.tsx";

type Open = "billing" | "owner" | "details" | "pause" | "resume" | "archive" | "restore" | null;

const STATUS_ACTION = {
  pause: { title: "Pause this gym?", text: "Owner and staff are locked out, sign-ups, check-ins and reminders stop. Members can still see their own page.", label: "Pause gym", done: "Gym paused", danger: true },
  resume: { title: "Resume this gym?", text: "Owner and staff get back in straight away.", label: "Resume gym", done: "Gym resumed", danger: false },
  archive: { title: "Archive this gym?", text: "The gym closes and leaves the list. Nothing is deleted; you can restore it later.", label: "Archive gym", done: "Gym archived", danger: true },
  restore: { title: "Restore this gym?", text: "The gym comes back as active.", label: "Restore gym", done: "Gym restored", danger: false },
} as const;

export function PlatformGymPage({ gymId }: { gymId: string }) {
  const { session } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<PlatformGymDetail>(`/platform/gyms/${gymId}`);
  const [open, setOpen] = useState<Open>(null);
  const done = (message: string) => {
    setOpen(null);
    toast(message);
    reload();
  };

  const back = (
    <Link href="/platform" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, minHeight: 32 }}>
      <PiArrowLeftBold aria-hidden /> All gyms
    </Link>
  );
  if (error && !data) {
    return (
      <NarrowLayout title="GymDesk Platform" wide>
        {back}
        <ErrorState message={error.message} onRetry={reload} />
      </NarrowLayout>
    );
  }
  if (loading && !data) {
    return (
      <NarrowLayout title="GymDesk Platform" wide>
        {back}
        <Skeleton height={160} radius={12} />
        <Skeleton height={220} radius={12} />
      </NarrowLayout>
    );
  }
  if (!data) return null;
  const { gym, staff, billing, today } = data;
  const statusAction = open === "pause" || open === "resume" || open === "archive" || open === "restore" ? open : null;

  return (
    <NarrowLayout title="GymDesk Platform" subtitle={session?.user?.email} wide>
      {back}
      <div className="card card--pad enter" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ overflowWrap: "anywhere" }}>{gym.name}</h1>
            <p className="muted" style={{ fontSize: 14, overflowWrap: "anywhere" }}>
              /g/{gym.slug}
              {gym.address ? ` · ${gym.address}` : ""}
            </p>
          </div>
          <Badge tone={ACCESS_TONE[gym.access]}>{GYM_ACCESS_LABEL[gym.access]}</Badge>
        </div>
        {gym.status !== "ACTIVE" && gym.statusReason && (
          <Notice tone={gym.status === "PAUSED" ? "danger" : "warning"}>
            {gym.status === "PAUSED" ? "Paused" : "Archived"} {formatDateTime(gym.statusChangedAt)}: {gym.statusReason}
          </Notice>
        )}
        {gym.status === "ACTIVE" && gym.access === "PAUSED" && <Notice tone="danger">Paused automatically: the plan ended on {formatDate(gym.validTill)} and the {SAAS_GRACE_DAYS}-day grace is over. Record a payment to reopen.</Notice>}
        {gym.access === "GRACE" && <Notice tone="warning">The plan ended on {formatDate(gym.validTill)}. It pauses itself after {SAAS_GRACE_DAYS} days.</Notice>}
        {gym.ownerEmail === session?.user?.email && <Notice tone="warning">The owner is your platform email. Change it to the gym owner's own Gmail.</Notice>}
        <div className="detail-actions">
          <div className="detail-actions__main">
            <Button variant="primary" icon={<PiWalletBold />} onClick={() => setOpen("billing")}>
              Record payment
            </Button>
            {gym.status === "ACTIVE" && (
              <Button icon={<PiPauseBold />} onClick={() => setOpen("pause")}>
                Pause
              </Button>
            )}
            {gym.status === "PAUSED" && (
              <Button icon={<PiPlayBold />} onClick={() => setOpen("resume")}>
                Resume
              </Button>
            )}
          </div>
          <div className="detail-actions__quick">
            <Button icon={<PiUserCheckBold />} onClick={() => setOpen("owner")}>
              Owner
            </Button>
            <Button icon={<PiPencilSimpleBold />} onClick={() => setOpen("details")}>
              Edit
            </Button>
            {gym.status === "ARCHIVED" ? (
              <Button icon={<PiArrowCounterClockwiseBold />} onClick={() => setOpen("restore")}>
                Restore
              </Button>
            ) : (
              <Button variant="danger-ghost" icon={<PiArchiveBold />} onClick={() => setOpen("archive")}>
                Archive
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="stats enter-stagger">
        <div className="stat">
          <span className="stat__label">Active members</span>
          <span className="stat__value">{gym.activeMembers}</span>
          <span className="stat__hint">of {gym.members} members</span>
        </div>
        <div className="stat">
          <span className="stat__label">Pending at desk</span>
          <span className="stat__value">{gym.pending}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Staff</span>
          <span className="stat__value">{gym.staff}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Last activity</span>
          <span className="stat__value" style={{ fontSize: 22, lineHeight: 1.6 }}>
            {gym.lastActivityAt ? formatDate(gym.lastActivityAt.slice(0, 10)) : "—"}
          </span>
        </div>
      </div>

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card">
            <div className="card__head">
              <span className="section__title">GymDesk plan</span>
            </div>
            <div className="card__body">
              <dl className="kv">
                <dt>Plan</dt>
                <dd>{gym.saasPlanName ?? "—"}</dd>
                <dt>Valid till</dt>
                <dd>{gym.validTill ? formatDate(gym.validTill) : "No end date"}</dd>
                <dt>Onboarded</dt>
                <dd>{formatDateTime(gym.createdAt)}</dd>
              </dl>
            </div>
          </section>
          <section className="card">
            <div className="card__head">
              <span className="section__title">Payments to GymDesk</span>
            </div>
            {billing.length === 0 ? (
              <EmptyState icon={<PiWalletDuotone />} title="No payments yet" text="Record what the gym pays you to move its valid-till date." />
            ) : (
              <div className="list">
                {billing.map((b) => (
                  <div className="list-row" key={b.id}>
                    <span className="list-row__main">
                      <span className="list-row__title">{b.planName}</span>
                      <span className="list-row__sub">
                        {formatDate(b.paidOn)} · {b.mode} · till {formatDate(b.validTillAfter)}
                      </span>
                      {b.note && <span className="list-row__sub">{b.note}</span>}
                    </span>
                    <span className="tabular" style={{ fontWeight: 700 }}>
                      {formatRupees(b.amountPaise)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="card">
          <div className="card__head">
            <span className="section__title">Owner and staff</span>
          </div>
          <div className="list">
            {staff.map((s) => (
              <div className="list-row" key={s.email} style={{ opacity: s.active ? 1 : 0.55 }}>
                <span className="list-row__main">
                  <span className="list-row__title">{s.userName ?? s.email}</span>
                  <span className="list-row__sub">{s.email}</span>
                  <span className="list-row__sub">{s.lastLoginAt ? `Last sign-in ${formatDateTime(s.lastLoginAt)}` : "Never signed in"}</span>
                </span>
                <span className="list-row__end">
                  <Badge tone={s.role === "OWNER" ? "accent" : "neutral"}>{ROLE_LABEL[s.role]}</Badge>
                  {!s.active && <Badge>Removed</Badge>}
                </span>
              </div>
            ))}
          </div>
          <div className="card__body">
            <ButtonLink href={`/poster/${gym.slug}`} external icon={<PiArrowSquareOutBold />}>
              Gym QR poster
            </ButtonLink>
          </div>
        </section>
      </div>

      <BillingSheet open={open === "billing"} gym={gym} today={today} onClose={() => setOpen(null)} onDone={done} />
      <OwnerSheet open={open === "owner"} gym={gym} today={today} onClose={() => setOpen(null)} onDone={done} />
      <DetailsSheet open={open === "details"} gym={gym} today={today} onClose={() => setOpen(null)} onDone={done} />
      {statusAction && (
        <ReasonSheet
          open
          title={STATUS_ACTION[statusAction].title}
          description={STATUS_ACTION[statusAction].text}
          confirmLabel={STATUS_ACTION[statusAction].label}
          danger={STATUS_ACTION[statusAction].danger}
          placeholder="Payment pending, gym closed…"
          onClose={() => setOpen(null)}
          onConfirm={async (reason) => {
            await api.post(`/platform/gyms/${gym.id}/${statusAction}`, { reason });
            done(STATUS_ACTION[statusAction].done);
          }}
        />
      )}
    </NarrowLayout>
  );
}
