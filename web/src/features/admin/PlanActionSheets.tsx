/* Actions on one subscription: take a payment toward its dues, freeze it, or cancel it with a refund (owner). */
import { useEffect, useState } from "react";
import type { Subscription } from "../../../../shared/api.ts";
import type { PaymentMode } from "../../../../shared/constants.ts";
import { addDays, daysBetween } from "../../../../shared/dates.ts";
import { formatRupees, paiseToInput, rupeesToPaise, unusedValue } from "../../../../shared/money.ts";
import { ApiRequestError, api, errorField, errorMessage } from "../../lib/api.ts";
import { formatDate } from "../../lib/format.ts";
import { MODE_LABEL } from "../../lib/states.ts";
import { Button } from "../../components/ui/Button.tsx";
import { MoneyField, Segmented, Switch, TextAreaField, TextField } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";

const MODES = (Object.keys(MODE_LABEL) as PaymentMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }));

interface BaseProps {
  open: boolean;
  gymId: string;
  sub: Subscription | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function PaymentSheet({ open, gymId, sub, onClose, onDone }: BaseProps) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [note, setNote] = useState("");
  const { busy, error, setError, run } = useSubmit();
  useEffect(() => {
    if (open && sub) {
      setAmount(paiseToInput(sub.duePaise));
      setNote("");
      setError(null);
    }
  }, [open, sub, setError]);
  if (!sub) return null;
  const paise = rupeesToPaise(amount);
  const submit = () =>
    run(async () => {
      if (paise == null || paise <= 0) throw new ApiRequestError(400, "Please enter the amount received.", "amountPaise");
      await api.post(`/gyms/${gymId}/subscriptions/${sub.id}/payments`, { amountPaise: paise, mode, note: note || null });
      onDone(`${formatRupees(paise)} recorded`);
    });
  return (
    <Sheet
      open={open}
      title="Take payment"
      description={`${sub.planName} · ${formatRupees(sub.duePaise)} due`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Record {paise ? formatRupees(paise) : "payment"}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <MoneyField label="Amount received" value={amount} onChange={(e) => setAmount(e.target.value)} error={error?.field === "amountPaise" ? error.message : null} />
        <Segmented label="Paid by" value={mode} onChange={setMode} options={MODES} />
        <TextField label="Note" optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="UPI reference, cheque no…" />
        {error && error.field !== "amountPaise" && <Notice tone="danger">{error.message}</Notice>}
        <p className="muted" style={{ fontSize: 13 }}>
          The owner gets a notification for every payment.
        </p>
      </div>
    </Sheet>
  );
}

export function FreezeSheet({ open, gymId, sub, today, isOwner, onClose, onDone }: BaseProps & { today: string; isOwner: boolean }) {
  const [fromDate, setFromDate] = useState(today);
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const { busy, error, setError, run } = useSubmit();
  useEffect(() => {
    if (open) {
      setFromDate(today);
      setDays("7");
      setReason("");
      setError(null);
    }
  }, [open, today, setError]);
  if (!sub) return null;
  const n = Number(days);
  const left = sub.maxFreezeDays - sub.freezeDaysUsed;
  const valid = Number.isInteger(n) && n > 0;
  const submit = () =>
    run(async () => {
      await api.post(`/gyms/${gymId}/subscriptions/${sub.id}/freezes`, { fromDate, days: n, reason });
      onDone(`Frozen for ${n} days`);
    });
  return (
    <Sheet
      open={open}
      title="Freeze plan"
      description={`${sub.planName} · ${left > 0 ? `${left} of ${sub.maxFreezeDays} freeze days left` : "No freeze days left on this plan"}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!valid || !reason.trim()} onClick={() => void submit()}>
            Freeze
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-grid form-grid--2">
          <TextField label="From" type="date" value={fromDate} min={isOwner ? sub.startDate : today} max={sub.endDate} onChange={(e) => setFromDate(e.target.value)} error={error?.field === "fromDate" ? error.message : null} />
          <TextField label="Days" type="number" inputMode="numeric" min={1} value={days} onChange={(e) => setDays(e.target.value)} error={error?.field === "days" ? error.message : null} />
        </div>
        {valid && (
          <Notice tone="info">
            Back on {formatDate(addDays(fromDate, n))}. The plan will now end on {formatDate(addDays(sub.endDate, n))}, and any renewal moves too.
          </Notice>
        )}
        {isOwner && valid && n > left && <Notice tone="warning">This is more than the plan allows. As the owner you can still go ahead.</Notice>}
        <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Injury, travel, exams…" maxLength={200} />
        {error && !["fromDate", "days"].includes(error.field ?? "") && <Notice tone="danger">{error.message}</Notice>}
      </div>
    </Sheet>
  );
}

export function CancelSheet({ open, gymId, sub, today, onClose, onDone }: BaseProps & { today: string }) {
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(false);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const { busy, error, setError, run } = useSubmit();
  const suggestion = sub ? unusedValue(sub.finalPricePaise, daysBetween(sub.startDate, sub.endDate) + 1, Math.min(daysBetween(today, sub.endDate) + 1, daysBetween(sub.startDate, sub.endDate) + 1)) : 0;
  const maxRefund = sub?.paidPaise ?? 0;
  useEffect(() => {
    if (open) {
      setReason("");
      setRefund(false);
      setAmount(paiseToInput(Math.min(suggestion, maxRefund)));
      setError(null);
    }
  }, [open, suggestion, maxRefund, setError]);
  if (!sub) return null;
  const paise = rupeesToPaise(amount);
  const submit = () =>
    run(async () => {
      await api.post(`/gyms/${gymId}/subscriptions/${sub.id}/cancel`, { reason, refund: refund && paise ? { amountPaise: paise, mode } : null });
      onDone("Plan cancelled");
    });
  return (
    <Sheet
      open={open}
      title="Cancel plan"
      description={`${sub.planName} · paid ${formatRupees(sub.paidPaise)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => void submit()}>
            Cancel plan
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Notice tone="warning">The plan stays in the records as cancelled. Nothing is deleted.</Notice>
        <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Moving city, upgrading to a longer plan…" maxLength={200} />
        {maxRefund > 0 && <Switch checked={refund} onChange={setRefund} label="Give a refund" hint={`Unused value about ${formatRupees(suggestion)}. Most refundable: ${formatRupees(maxRefund)}.`} />}
        {refund && (
          <div className="form-grid form-grid--2">
            <MoneyField label="Refund amount" value={amount} onChange={(e) => setAmount(e.target.value)} error={error?.field === "amountPaise" ? error.message : null} />
            <Segmented label="Refunded by" value={mode} onChange={setMode} options={MODES} />
          </div>
        )}
        {!refund && sub.paidPaise > 0 && (
          <p className="muted" style={{ fontSize: 13 }}>
            Upgrading? Cancel this plan, then start the new one and lower its price by the unused value ({formatRupees(suggestion)}).
          </p>
        )}
        {error && error.field !== "amountPaise" && <Notice tone="danger">{error.message}</Notice>}
      </div>
    </Sheet>
  );
}
