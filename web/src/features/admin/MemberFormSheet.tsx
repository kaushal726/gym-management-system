/* Add a walk-in at the desk, or edit someone's details. A changed phone number is kept in history. */
import { useEffect, useState } from "react";
import type { MemberInput, MemberProfile } from "../../../../shared/api.ts";
import { GENDERS, type Gender } from "../../../../shared/constants.ts";
import { ageOn } from "../../../../shared/dates.ts";
import { api, errorField, errorMessage } from "../../lib/api.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Segmented, TextField } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";

const GENDER_LABEL: Record<Gender, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

function emptyForm(m?: MemberProfile | null) {
  return {
    name: m?.name ?? "",
    phone: m?.phone ?? "",
    email: m?.inviteEmail ?? "",
    dob: m?.dob ?? "",
    gender: (m?.gender ?? "") as Gender | "",
    emergencyName: m?.emergencyName ?? "",
    emergencyPhone: m?.emergencyPhone ?? "",
    guardianName: m?.guardianName ?? "",
    guardianPhone: m?.guardianPhone ?? "",
  };
}

interface Props {
  open: boolean;
  gymId: string;
  today: string;
  member?: MemberProfile | null;
  onClose: () => void;
  onSaved: (memberId: string) => void;
}

export function MemberFormSheet({ open, gymId, today, member, onClose, onSaved }: Props) {
  const [form, setForm] = useState(emptyForm(member));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  useEffect(() => {
    if (open) {
      setForm(emptyForm(member));
      setError(null);
    }
  }, [open, member]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const minor = form.dob !== "" && form.dob <= today && ageOn(form.dob, today) < 18;
  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const body: MemberInput = {
      name: form.name,
      phone: form.phone,
      email: form.email.trim() || null,
      dob: form.dob || null,
      gender: form.gender || null,
      emergencyName: form.emergencyName || null,
      emergencyPhone: form.emergencyPhone || null,
      guardianName: minor ? form.guardianName || null : null,
      guardianPhone: minor ? form.guardianPhone || null : null,
    };
    try {
      if (member) {
        await api.patch(`/gyms/${gymId}/members/${member.id}`, body);
        onSaved(member.id);
      } else {
        const res = await api.post<{ id: string }>(`/gyms/${gymId}/members`, body);
        onSaved(res.id);
      }
    } catch (err) {
      setError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      title={member ? "Edit details" : "Add member"}
      description={member ? undefined : "For walk-ins and existing members from your register. You'll pick the plan next."}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {member ? "Save" : "Add and choose plan"}
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
        <TextField label="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} error={fieldError("name")} />
        <TextField label="Mobile number" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={fieldError("phone")} hint={member ? "The old number is kept in history." : undefined} />
        <TextField
          label="Gmail"
          optional
          type="email"
          inputMode="email"
          autoComplete="off"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          maxLength={254}
          disabled={!!member?.linkedEmail}
          error={fieldError("email")}
          hint={member?.linkedEmail ? `Signs in as ${member.linkedEmail}. To change it, unlink the app from More first.` : "When they sign in with Google using this email, their plan and dues open on their phone."}
        />
        <div className="form-grid form-grid--2">
          <TextField label="Date of birth" optional type="date" max={today} value={form.dob} onChange={(e) => set("dob", e.target.value)} error={fieldError("dob")} />
          <Segmented label="Gender" optional value={form.gender as Gender} onChange={(v) => set("gender", v)} options={GENDERS.map((g) => ({ value: g, label: GENDER_LABEL[g] }))} />
        </div>
        {minor && (
          <div className="form-grid form-grid--2">
            <TextField label="Guardian's name" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} error={fieldError("guardianName")} />
            <TextField label="Guardian's mobile" type="tel" inputMode="numeric" value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} error={fieldError("guardianPhone")} />
          </div>
        )}
        <div className="form-grid form-grid--2">
          <TextField label="Emergency contact" optional value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} error={fieldError("emergencyName")} />
          <TextField label="Emergency mobile" optional type="tel" inputMode="numeric" value={form.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} error={fieldError("emergencyPhone")} />
        </div>
        {error && !error.field && <Notice tone="danger">{error.message}</Notice>}
        {error?.field && !["name", "phone", "email", "dob", "guardianName", "guardianPhone", "emergencyName", "emergencyPhone"].includes(error.field) && <Notice tone="danger">{error.message}</Notice>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
