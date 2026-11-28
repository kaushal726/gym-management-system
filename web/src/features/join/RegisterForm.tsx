/* The self-registration form behind the gym's QR. Only what the desk needs; the plan is chosen at the desk. */
import { useState } from "react";
import type { RegisterInput } from "../../../../shared/api.ts";
import { BATCH_LABEL, GENDERS, type Batch, type Gender } from "../../../../shared/constants.ts";
import { ageOn } from "../../../../shared/dates.ts";
import { api, errorField, errorMessage } from "../../lib/api.ts";
import { localToday } from "../../lib/format.ts";
import { useSession } from "../../lib/session.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Checkbox, Segmented, TextField } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";

const GENDER_LABEL: Record<Gender, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

export function RegisterForm({ slug, gymName, batches, onDone }: { slug: string; gymName: string; batches: readonly Batch[]; onDone: () => void }) {
  const { session } = useSession();
  const [form, setForm] = useState({
    name: session?.user?.name ?? "",
    phone: "",
    dob: "",
    gender: "" as Gender | "",
    batch: "" as Batch | "",
    emergencyName: "",
    emergencyPhone: "",
    guardianName: "",
    guardianPhone: "",
    consent: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const today = localToday();
  const minor = form.dob !== "" && form.dob <= today && ageOn(form.dob, today) < 18;
  const fieldError = (field: string) => (error?.field === field ? error.message : null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const body: RegisterInput = {
      name: form.name,
      phone: form.phone,
      dob: form.dob || null,
      gender: form.gender || null,
      batch: form.batch || null,
      emergencyName: form.emergencyName,
      emergencyPhone: form.emergencyPhone,
      guardianName: minor ? form.guardianName : null,
      guardianPhone: minor ? form.guardianPhone : null,
      consent: form.consent,
    };
    try {
      await api.post(`/public/gyms/${slug}/register`, body);
      onDone();
    } catch (err) {
      setError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="card card--pad form-grid enter"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <div>
        <h2>Your details</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          Fill this once. The desk will pick your plan and take the payment.
        </p>
      </div>
      <TextField label="Gmail" type="email" value={session?.user?.email ?? ""} readOnly disabled hint="From your Google sign-in. This is how you open your plan later." />
      <TextField label="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={80} required error={fieldError("name")} />
      <TextField label="Mobile number" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel-national" placeholder="98765 43210" required error={fieldError("phone")} hint="Reminders and receipts are linked to this number." />
      <div className="form-grid form-grid--2">
        <TextField label="Date of birth" optional type="date" value={form.dob} max={today} onChange={(e) => set("dob", e.target.value)} error={fieldError("dob")} />
        <Segmented label="Gender" optional value={form.gender as Gender} onChange={(v) => set("gender", v)} options={GENDERS.map((g) => ({ value: g, label: GENDER_LABEL[g] }))} />
      </div>
      <Segmented label="Batch" optional value={form.batch as Batch} onChange={(v) => set("batch", v)} options={batches.map((b) => ({ value: b, label: BATCH_LABEL[b] }))} />
      {minor && (
        <div className="form-grid form-grid--2">
          <Notice tone="info">Members under 18 need a parent or guardian's details.</Notice>
          <span className="hide-mobile" />
          <TextField label="Parent or guardian's name" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} error={fieldError("guardianName")} />
          <TextField label="Parent or guardian's mobile" type="tel" inputMode="numeric" value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} error={fieldError("guardianPhone")} />
        </div>
      )}
      <div className="form-grid form-grid--2">
        <TextField label="Emergency contact name" optional value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} error={fieldError("emergencyName")} />
        <TextField label="Emergency contact mobile" optional type="tel" inputMode="numeric" value={form.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} error={fieldError("emergencyPhone")} />
      </div>
      <Checkbox checked={form.consent} onChange={(v) => set("consent", v)}>
        I agree that {gymName} may keep these details to manage my membership and send me reminders. I can ask the gym to delete them.
      </Checkbox>
      {error && !["name", "phone", "dob", "guardianName", "guardianPhone", "emergencyName", "emergencyPhone"].includes(error.field ?? "") && <Notice tone="danger">{error.message}</Notice>}
      <Button type="submit" variant="primary" block loading={busy} disabled={!form.consent}>
        Send my details
      </Button>
    </form>
  );
}
