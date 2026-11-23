/* Tapping a plan or a payment row opens its details and the actions allowed on it. */
import { useState } from "react";
import { FiCreditCard, FiPauseCircle, FiXCircle } from "react-icons/fi";
import type { Payment, Subscription } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { api } from "../../lib/api.ts";
import { formatDate, formatDateTime, planLength } from "../../lib/format.ts";
import { MODE_LABEL } from "../../lib/states.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";
import { ReasonSheet } from "../../components/ui/ReasonSheet.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";

export function SubscriptionDetailSheet({
  open,
  sub,
  today,
  isOwner,
  onClose,
  onAction,
}: {
  open: boolean;
  sub: Subscription | null;
  today: string;
  isOwner: boolean;
  onClose: () => void;
  onAction: (action: "pay" | "freeze" | "cancel", sub: Subscription) => void;
}) {
  if (!sub) return null;
  const live = !sub.cancelledAt;
  const running = live && sub.startDate <= today && today <= sub.endDate;
  const total = sub.finalPricePaise + sub.joiningFeePaise;
  return (
    <Sheet open={open} title={sub.planName} description={`${formatDate(sub.startDate)} – ${formatDate(sub.endDate)}`} onClose={onClose}>
      <div className="form-grid">
        <dl className="kv">
          <dt>Length</dt>
          <dd>{planLength(sub.durationMonths, sub.durationDays)}</dd>
          {sub.trainerName && (
            <>
              <dt>Trainer</dt>
              <dd>{sub.trainerName}</dd>
            </>
          )}
          <dt>Price</dt>
          <dd className="tabular">
            {formatRupees(sub.finalPricePaise)}
            {sub.finalPricePaise !== sub.listPricePaise && <span className="muted"> (list {formatRupees(sub.listPricePaise)})</span>}
          </dd>
          {sub.discountReason && (
            <>
              <dt>Price note</dt>
              <dd>{sub.discountReason}</dd>
            </>
          )}
          {sub.joiningFeePaise > 0 && (
            <>
              <dt>Joining fee</dt>
              <dd className="tabular">{formatRupees(sub.joiningFeePaise)}</dd>
            </>
          )}
          <dt>Total</dt>
          <dd className="tabular">{formatRupees(total)}</dd>
          <dt>Paid</dt>
          <dd className="tabular">{formatRupees(sub.paidPaise)}</dd>
          <dt>Dues</dt>
          <dd className="tabular" style={{ color: sub.duePaise ? "var(--warning)" : undefined, fontWeight: 700 }}>
            {formatRupees(sub.duePaise)}
          </dd>
          <dt>Freeze days</dt>
          <dd>
            {sub.freezeDaysUsed} used of {sub.maxFreezeDays}
          </dd>
          {sub.backdateReason && (
            <>
              <dt>Backdated</dt>
              <dd>{sub.backdateReason}</dd>
            </>
          )}
          <dt>Created</dt>
          <dd>
            {formatDateTime(sub.createdAt)}
            {sub.createdByName ? ` · ${sub.createdByName}` : ""}
          </dd>
        </dl>
        {sub.cancelledAt && <Notice tone="danger">Cancelled {formatDateTime(sub.cancelledAt)}: {sub.cancelledReason}</Notice>}
        {live && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sub.duePaise > 0 && (
              <Button variant="primary" icon={<FiCreditCard />} onClick={() => onAction("pay", sub)}>
                Take payment
              </Button>
            )}
            {(running || sub.startDate > today) && (
              <Button icon={<FiPauseCircle />} onClick={() => onAction("freeze", sub)}>
                Freeze
              </Button>
            )}
            {isOwner && (
              <Button variant="danger-ghost" icon={<FiXCircle />} onClick={() => onAction("cancel", sub)}>
                Cancel plan
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function PaymentDetailSheet({ open, payment, gymId, isOwner, onClose, onDone }: { open: boolean; payment: Payment | null; gymId: string; isOwner: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const [voiding, setVoiding] = useState(false);
  if (!payment) return null;
  const refund = payment.amountPaise < 0;
  return (
    <>
      <Sheet open={open && !voiding} title={`Receipt #${payment.receiptNo}`} description={payment.planName} onClose={onClose}>
        <div className="form-grid">
          <dl className="kv">
            <dt>{refund ? "Refunded" : "Amount"}</dt>
            <dd className={`tabular${payment.voidedAt ? " strike" : ""}`} style={{ fontWeight: 700 }}>
              {formatRupees(Math.abs(payment.amountPaise))}
            </dd>
            <dt>Mode</dt>
            <dd>{MODE_LABEL[payment.mode]}</dd>
            <dt>Date</dt>
            <dd>{formatDate(payment.paidOn)}</dd>
            <dt>{refund ? "Refunded by" : "Collected by"}</dt>
            <dd>{payment.collectedByName ?? "—"}</dd>
            {payment.note && (
              <>
                <dt>Note</dt>
                <dd>{payment.note}</dd>
              </>
            )}
            <dt>Entered</dt>
            <dd>{formatDateTime(payment.createdAt)}</dd>
          </dl>
          {payment.voidedAt && (
            <Notice tone="danger">
              Voided {formatDateTime(payment.voidedAt)}: {payment.voidReason}
            </Notice>
          )}
          {!payment.voidedAt && !refund && isOwner && (
            <Button variant="danger-ghost" icon={<FiXCircle />} onClick={() => setVoiding(true)}>
              Void this entry
            </Button>
          )}
          {!isOwner && !payment.voidedAt && (
            <p className="muted" style={{ fontSize: 13 }}>
              Wrong entry? Ask the owner to void it. Entries are never deleted.
            </p>
          )}
        </div>
      </Sheet>
      <ReasonSheet
        open={open && voiding}
        title={`Void receipt #${payment.receiptNo}?`}
        description={`${formatRupees(payment.amountPaise)} will no longer count as paid. The entry stays in the records.`}
        confirmLabel="Void entry"
        danger
        placeholder="Entered twice, wrong amount…"
        onClose={() => setVoiding(false)}
        onConfirm={async (reason) => {
          await api.post(`/gyms/${gymId}/payments/${payment.id}/void`, { reason });
          setVoiding(false);
          onDone("Entry voided");
        }}
      />
    </>
  );
}
