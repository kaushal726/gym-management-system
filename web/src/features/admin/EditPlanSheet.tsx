/* Owner fixes a plan a member already took: another plan, another start date or another price.
 * Payments stay as they are; the new end date and dues show before saving. */
import { useEffect, useState } from "react";
import type { Plan, Subscription } from "../../../../shared/api.ts";
import { formatRupees, paiseToInput, rupeesToPaise } from "../../../../shared/money.ts";
import { EDIT_PROBLEM_MESSAGE, planEdit } from "../../../../shared/subscriptionEdit.ts";
import { ApiRequestError, api, errorField, errorMessage } from "../../lib/api.ts";
import { formatDate, planLength } from "../../lib/format.ts";
import { useApi } from "../../lib/useApi.ts";
import { Button } from "../../components/ui/Button.tsx";
import { MoneyField, SelectField, TextAreaField, TextField } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";

/** Select value for "keep the plan it was sold as" when that plan is no longer on sale. */
const KEEP_CURRENT = "";

interface Props {
  open: boolean;
  gymId: string;
  sub: Subscription | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function EditPlanSheet({ open, gymId, sub, onClose, onDone }: Props) {
  const plans = useApi<{ items: Plan[] }>(open ? `/gyms/${gymId}/plans` : null);
  const [planId, setPlanId] = useState(KEEP_CURRENT);
  const [startDate, setStartDate] = useState("");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  useEffect(() => {
    if (!open || !sub) return;
    setPlanId(sub.planId ?? KEEP_CURRENT);
    setStartDate(sub.startDate);
    setPrice(paiseToInput(sub.finalPricePaise));
    setReason("");
    setError(null);
  }, [open, sub]);

  if (!sub) return null;
  const choices = (plans.data?.items ?? []).filter((p) => p.kind === sub.kind && (p.active || p.id === sub.planId));
  const chosen = choices.find((p) => p.id === planId) ?? null;
  const length = chosen && chosen.id !== sub.planId ? chosen : sub;
  const pricePaise = rupeesToPaise(price);
  const preview = pricePaise == null || !startDate ? null : planEdit(sub, { startDate, durationMonths: length.durationMonths, durationDays: length.durationDays, finalPricePaise: pricePaise });
  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  const pickPlan = (id: string) => {
    setPlanId(id);
    const plan = choices.find((p) => p.id === id);
    if (plan) setPrice(paiseToInput(id === sub.planId ? sub.finalPricePaise : plan.pricePaise));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (pricePaise == null) throw new ApiRequestError(400, "Please enter the price.", "finalPricePaise");
      await api.patch(`/gyms/${gymId}/subscriptions/${sub.id}`, { planId: planId || null, startDate, finalPricePaise: pricePaise, reason });
      onDone("Plan updated");
    } catch (err) {
      setError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      title="Edit plan"
      description={`${sub.planName} · paid ${formatRupees(sub.paidPaise)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!preview || "problem" in preview} onClick={() => void save()}>
            Save changes
          </Button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <SelectField label="Plan" value={planId} onChange={(e) => pickPlan(e.target.value)} error={fieldError("planId")} disabled={plans.loading && !plans.data}>
          {!sub.planId && <option value={KEEP_CURRENT}>{sub.planName} (as sold)</option>}
          {choices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {planLength(p.durationMonths, p.durationDays)} · {formatRupees(p.pricePaise)}
            </option>
          ))}
        </SelectField>
        <div className="form-grid form-grid--2">
          <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} error={fieldError("startDate")} disabled={sub.freezeDaysUsed > 0} hint={sub.freezeDaysUsed > 0 ? "Locked: this plan has a freeze." : undefined} />
          <MoneyField label="Price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={fieldError("finalPricePaise")} />
        </div>
        {preview &&
          ("problem" in preview ? (
            <Notice tone="warning">{EDIT_PROBLEM_MESSAGE[preview.problem]}</Notice>
          ) : (
            <dl className="kv card card--pad">
              <dt>New dates</dt>
              <dd>
                {formatDate(startDate)} – {formatDate(preview.endDate)}
              </dd>
              <dt>New dues</dt>
              <dd className="tabular" style={{ fontWeight: 700 }}>
                {formatRupees((pricePaise ?? 0) + sub.joiningFeePaise - sub.paidPaise)}
              </dd>
            </dl>
          ))}
        <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={2} placeholder="Wrong plan picked, price agreed at the desk…" error={fieldError("reason")} hint="Saved in the audit log." />
        {error && !["planId", "startDate", "finalPricePaise", "reason"].includes(error.field ?? "") && <Notice tone="danger">{error.message}</Notice>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
