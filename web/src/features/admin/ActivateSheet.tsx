/* Start or renew a plan and take the payment in the same step. This is also how a pending request is approved. */
import { useEffect, useMemo, useState } from "react";
import type { ActivateInput, MemberDetail, Plan } from "../../../../shared/api.ts";
import type { PaymentMode, PlanKind } from "../../../../shared/constants.ts";
import { planEndDate } from "../../../../shared/dates.ts";
import { formatRupees, paiseToInput, rupeesToPaise } from "../../../../shared/money.ts";
import { api, errorField, errorMessage } from "../../lib/api.ts";
import { formatDate, planLength } from "../../lib/format.ts";
import { MODE_LABEL } from "../../lib/states.ts";
import { useApi } from "../../lib/useApi.ts";
import { Button, ButtonLink } from "../../components/ui/Button.tsx";
import { MoneyField, Segmented, SelectField, Switch, TextField } from "../../components/ui/Field.tsx";
import { EmptyState, Notice, Skeleton } from "../../components/ui/Feedback.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { useAdmin } from "./AdminShell.tsx";

const MODES = (Object.keys(MODE_LABEL) as PaymentMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }));

interface Props {
  open: boolean;
  detail: MemberDetail;
  kind: PlanKind;
  onClose: () => void;
  onDone: () => void;
}

export function ActivateSheet({ open, detail, kind, onClose, onDone }: Props) {
  const { gymId, gym, isOwner, base } = useAdmin();
  const plans = useApi<{ items: Plan[] }>(open ? `/gyms/${gymId}/plans` : null);
  const options = useMemo(() => (plans.data?.items ?? []).filter((p) => p.active && p.kind === kind), [plans.data, kind]);
  const defaultStart = kind === "PT" ? detail.nextPtStartDate : detail.nextStartDate;
  const firstMembership = kind === "MEMBERSHIP" && detail.isFirstSubscription;

  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(defaultStart);
  const [price, setPrice] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [joiningFee, setJoiningFee] = useState("");
  const [backdateReason, setBackdateReason] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [payNow, setPayNow] = useState(true);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const plan = options.find((p) => p.id === planId) ?? null;
  useEffect(() => {
    if (!open) return;
    setStartDate(defaultStart);
    setJoiningFee(firstMembership ? paiseToInput(gym.joiningFeePaise) : "0");
    setError(null);
  }, [open, defaultStart, firstMembership, gym.joiningFeePaise]);
  useEffect(() => {
    if (open && options.length && !options.some((p) => p.id === planId)) setPlanId(options[0].id);
  }, [open, options, planId]);
  useEffect(() => {
    if (plan) setPrice(paiseToInput(plan.pricePaise));
  }, [plan]);

  const pricePaise = rupeesToPaise(price);
  const feePaise = rupeesToPaise(joiningFee || "0");
  const total = (pricePaise ?? 0) + (feePaise ?? 0);
  useEffect(() => setAmount(total > 0 ? paiseToInput(total) : ""), [total]);
  const amountPaise = payNow ? rupeesToPaise(amount) : 0;
  const endDate = plan && startDate ? planEndDate(startDate, { durationMonths: plan.durationMonths, durationDays: plan.durationDays }) : null;
  const backdated = startDate < detail.today;
  const discounted = plan != null && pricePaise != null && pricePaise !== plan.pricePaise;
  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  const submit = async () => {
    if (!plan || pricePaise == null || feePaise == null || (payNow && (amountPaise == null || amountPaise <= 0))) {
      setError({ message: "Please check the amounts.", field: pricePaise == null ? "finalPricePaise" : feePaise == null ? "joiningFeePaise" : "amountPaise" });
      return;
    }
    setBusy(true);
    setError(null);
    const body: ActivateInput = {
      planId: plan.id,
      startDate,
      finalPricePaise: pricePaise,
      discountReason: discounted ? discountReason || null : null,
      joiningFeePaise: feePaise,
      backdateReason: backdated ? backdateReason || null : null,
      trainerName: kind === "PT" ? trainerName || null : null,
      payment: payNow && amountPaise ? { amountPaise, mode, note: null } : null,
    };
    try {
      await api.post(`/gyms/${gymId}/members/${detail.member.id}/subscriptions`, body);
      onDone();
    } catch (err) {
      setError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  };

  const title = kind === "PT" ? "Add personal training" : detail.isFirstSubscription ? "Start membership" : "Renew membership";
  return (
    <Sheet
      open={open}
      wide
      title={title}
      description={detail.member.name}
      onClose={onClose}
      footer={
        options.length > 0 && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void submit()}>
              {payNow && amountPaise ? `Save · collect ${formatRupees(amountPaise)}` : "Save"}
            </Button>
          </>
        )
      }
    >
      {plans.loading && !plans.data ? (
        <div className="form-grid">
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      ) : options.length === 0 ? (
        <EmptyState
          icon={null}
          title={`No ${kind === "PT" ? "PT" : "membership"} plans yet`}
          text={isOwner ? "Create a plan first. It takes a few seconds." : "Ask the owner to add plans."}
          action={isOwner ? <ButtonLink href={`${base}/plans`} variant="primary">Create a plan</ButtonLink> : undefined}
        />
      ) : (
        <div className="form-grid">
          <SelectField label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)} error={fieldError("planId")}>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {planLength(p.durationMonths, p.durationDays)} · {formatRupees(p.pricePaise)}
              </option>
            ))}
          </SelectField>
          <div className="form-grid form-grid--2">
            <TextField
              label="Starts on"
              type="date"
              value={startDate}
              min={isOwner ? undefined : detail.today}
              onChange={(e) => setStartDate(e.target.value)}
              error={fieldError("startDate")}
              hint={endDate ? `Ends on ${formatDate(endDate)}` : undefined}
            />
            <MoneyField label="Price" value={price} onChange={(e) => setPrice(e.target.value)} error={fieldError("finalPricePaise")} hint={discounted && plan ? `List price ${formatRupees(plan.pricePaise)}` : undefined} />
          </div>
          {backdated && <TextField label="Why a past start date?" value={backdateReason} onChange={(e) => setBackdateReason(e.target.value)} placeholder="Joined earlier, entering from the register" error={fieldError("backdateReason")} />}
          {discounted && <TextField label="Reason for the changed price" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Student offer, festival discount…" error={fieldError("discountReason")} />}
          {kind === "PT" && <TextField label="Trainer" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} placeholder="Trainer's name" error={fieldError("trainerName")} />}
          {firstMembership && <MoneyField label="Joining fee" value={joiningFee} onChange={(e) => setJoiningFee(e.target.value)} error={fieldError("joiningFeePaise")} hint="Only on the first membership. Set 0 to waive." />}

          <hr className="divider" />
          <Switch checked={payNow} onChange={setPayNow} label="Take payment now" hint="Turn off if they will pay later. It shows as dues." />
          {payNow && (
            <div className="form-grid form-grid--2">
              <MoneyField label="Amount received" value={amount} onChange={(e) => setAmount(e.target.value)} error={fieldError("amountPaise")} hint={amountPaise != null && amountPaise < total ? `${formatRupees(total - amountPaise)} will show as dues` : undefined} />
              <Segmented label="Paid by" value={mode} onChange={setMode} options={MODES} />
            </div>
          )}
          <div className="card card--pad" style={{ background: "var(--surface-2)", borderColor: "transparent" }}>
            <dl className="kv">
              <dt>Total</dt>
              <dd className="tabular">{formatRupees(total)}</dd>
              <dt>Collecting now</dt>
              <dd className="tabular">{formatRupees(payNow ? (amountPaise ?? 0) : 0)}</dd>
              <dt>Dues after this</dt>
              <dd className="tabular" style={{ color: total - (payNow ? (amountPaise ?? 0) : 0) > 0 ? "var(--warning)" : undefined }}>
                {formatRupees(Math.max(0, total - (payNow ? (amountPaise ?? 0) : 0)))}
              </dd>
            </dl>
          </div>
          {error && <Notice tone="danger">{error.message}</Notice>}
        </div>
      )}
    </Sheet>
  );
}
