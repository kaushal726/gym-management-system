/* Platform console forms: record the gym's GymDesk payment, change the owner, edit the gym's details. */
import { useEffect, useState } from "react";
import type { GymBillingInput, GymDetailsInput, PlatformGymDetail } from "../../../../shared/api.ts";
import { addDays, planEndDate } from "../../../../shared/dates.ts";
import { formatRupees, rupeesToPaise } from "../../../../shared/money.ts";
import { SAAS_PAYMENT_MODES, type SaasPaymentMode } from "../../../../shared/saas.ts";
import { ApiRequestError, api, errorField, errorMessage } from "../../lib/api.ts";
import { formatDate } from "../../lib/format.ts";
import { Button } from "../../components/ui/Button.tsx";
import { MoneyField, Segmented, TextAreaField, TextField } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";

type Gym = PlatformGymDetail["gym"];
interface SheetProps {
  open: boolean;
  gym: Gym;
  today: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

const MODE_LABEL: Record<SaasPaymentMode, string> = { UPI: "UPI", CASH: "Cash", CARD: "Card", BANK: "Bank" };
const PLAN_MONTHS = [
  { label: "1 month", months: 1 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
];

function useForm() {
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
  const fieldError = (f: string) => (error?.field === f ? error.message : null);
  return { busy, error, setError, run, fieldError };
}

/** A renewal runs from the day after the later of yesterday and the current valid-till, so paying early loses no days. */
function extend(from: string, months: number): string {
  return planEndDate(addDays(from, 1), { durationMonths: months, durationDays: null });
}

export function BillingSheet({ open, gym, today, onClose, onDone }: SheetProps) {
  const base = gym.validTill && gym.validTill > today ? gym.validTill : addDays(today, -1);
  const [planName, setPlanName] = useState("Monthly");
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<SaasPaymentMode>("UPI");
  const [paidOn, setPaidOn] = useState(today);
  const [validTill, setValidTill] = useState(extend(base, 1));
  const [note, setNote] = useState("");
  const { busy, error, setError, run, fieldError } = useForm();
  useEffect(() => {
    if (!open) return;
    setPaidOn(today);
    setAmount("");
    setNote("");
    setError(null);
  }, [open, today, setError]);
  useEffect(() => setValidTill(extend(base, months)), [base, months]);

  const submit = () =>
    run(async () => {
      const amountPaise = rupeesToPaise(amount || "0");
      if (amountPaise == null) throw new ApiRequestError(400, "Please enter a valid amount.", "amountPaise");
      const body: GymBillingInput = { planName, amountPaise, mode, paidOn, validTill, note: note || null };
      await api.post(`/platform/gyms/${gym.id}/billing`, body);
      onDone(`Valid till ${formatDate(validTill)}`);
    });

  return (
    <Sheet
      open={open}
      title="Record GymDesk payment"
      description={gym.validTill ? `Now valid till ${formatDate(gym.validTill)}` : "No end date yet"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Save · till {formatDate(validTill)}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Segmented
          label="Plan length"
          value={String(months)}
          onChange={(v) => {
            const m = Number(v);
            setMonths(m);
            setPlanName(m === 12 ? "Yearly" : m === 1 ? "Monthly" : `${m} months`);
          }}
          options={PLAN_MONTHS.map((p) => ({ value: String(p.months), label: p.label }))}
        />
        <div className="form-grid form-grid--2">
          <TextField label="Plan name" value={planName} onChange={(e) => setPlanName(e.target.value)} error={fieldError("planName")} />
          <TextField label="Valid till" type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} error={fieldError("validTill")} />
        </div>
        <div className="form-grid form-grid--2">
          <MoneyField label="Amount received" value={amount} onChange={(e) => setAmount(e.target.value)} error={fieldError("amountPaise")} hint={amount && rupeesToPaise(amount) != null ? formatRupees(rupeesToPaise(amount)!) : "0 for a free extension"} />
          <TextField label="Paid on" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} error={fieldError("paidOn")} />
        </div>
        <Segmented label="Paid by" value={mode} onChange={setMode} options={SAAS_PAYMENT_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
        <TextField label="Note" optional value={note} onChange={(e) => setNote(e.target.value)} placeholder="UPI reference" maxLength={200} />
        {gym.access === "PAUSED" && gym.status === "PAUSED" && <Notice tone="warning">This gym was paused by hand. Recording a payment doesn't resume it; use Resume after saving.</Notice>}
        {error && !error.field && <Notice tone="danger">{error.message}</Notice>}
      </div>
    </Sheet>
  );
}

export function OwnerSheet({ open, gym, onClose, onDone }: SheetProps) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const { busy, error, setError, run, fieldError } = useForm();
  useEffect(() => {
    if (open) {
      setEmail("");
      setReason("");
      setError(null);
    }
  }, [open, setError]);
  const submit = () =>
    run(async () => {
      await api.post(`/platform/gyms/${gym.id}/owner`, { email, reason });
      onDone("Owner changed");
    });
  return (
    <Sheet
      open={open}
      title="Change owner"
      description={`Now: ${gym.ownerEmail ?? "none"}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!email || !reason.trim()} onClick={() => void submit()}>
            Change owner
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Notice tone="warning">The current owner loses access straight away. The new owner opens the gym by signing in with this Gmail.</Notice>
        <TextField label="New owner's Gmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError("email")} autoComplete="off" />
        <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Owner changed Gmail, gym sold…" maxLength={200} />
        {error && error.field !== "email" && <Notice tone="danger">{error.message}</Notice>}
      </div>
    </Sheet>
  );
}

export function DetailsSheet({ open, gym, onClose, onDone }: SheetProps) {
  const [form, setForm] = useState<GymDetailsInput>({ name: gym.name, slug: gym.slug, phone: gym.phone, address: gym.address });
  const { busy, error, setError, run, fieldError } = useForm();
  useEffect(() => {
    if (open) {
      setForm({ name: gym.name, slug: gym.slug, phone: gym.phone, address: gym.address });
      setError(null);
    }
  }, [open, gym, setError]);
  const submit = () =>
    run(async () => {
      await api.patch(`/platform/gyms/${gym.id}`, form);
      onDone("Details saved");
    });
  return (
    <Sheet
      open={open}
      title="Edit gym"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Save
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <TextField label="Gym name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError("name")} />
        <TextField label="Web address" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} error={fieldError("slug")} hint={`${window.location.origin}/g/${form.slug}`} />
        {form.slug !== gym.slug && <Notice tone="warning">Printed QR posters with the old address will stop working. The gym will need to print a new one.</Notice>}
        <div className="form-grid form-grid--2">
          <TextField label="Desk phone" optional value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} error={fieldError("phone")} />
          <TextField label="Address" optional value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value || null })} error={fieldError("address")} />
        </div>
        {error && !error.field && <Notice tone="danger">{error.message}</Notice>}
      </div>
    </Sheet>
  );
}
