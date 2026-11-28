/* Creates a gym: used by the platform console and by self-serve signup. */
import { useState } from "react";
import { PiCaretDownBold } from "react-icons/pi";
import { addDays } from "../../../../shared/dates.ts";
import { api, errorField, errorMessage } from "../../lib/api.ts";
import { localToday } from "../../lib/format.ts";
import { Button } from "../../components/ui/Button.tsx";
import { TextField } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";

/** The fields under "More details". */
const MORE_FIELDS = ["slug", "saasPlanName", "validTill", "phone", "address"];

/** Default free trial for a newly onboarded gym. */
const TRIAL_DAYS = 30;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function GymCreateForm({ endpoint, askOwner, onCreated }: { endpoint: string; askOwner: boolean; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [planName, setPlanName] = useState("Trial");
  const [validTill, setValidTill] = useState(() => addDays(localToday(), TRIAL_DAYS));
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const fieldError = (f: string) => (error?.field === f ? error.message : null);
  // A problem in a field that is tucked under "More details" opens it, so the message is never hidden.
  const moreOpen = more || (error?.field != null && MORE_FIELDS.includes(error.field));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ id: string }>(endpoint, {
        name,
        slug,
        ownerEmail: askOwner ? ownerEmail : undefined,
        phone: phone || null,
        address: address || null,
        ...(askOwner ? { saasPlanName: planName || null, validTill: validTill || null } : {}),
      });
      onCreated(res.id);
    } catch (err) {
      setError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <TextField
        label="Gym name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
        error={fieldError("name")}
      />
      {askOwner && <TextField label="Gym owner's Gmail" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} error={fieldError("ownerEmail")} hint="Only this Gmail can open the gym." />}
      <button type="button" className="disclosure" aria-expanded={moreOpen} onClick={() => setMore(!moreOpen)}>
        <span>More details</span>
        <PiCaretDownBold aria-hidden />
      </button>
      {moreOpen && (
        <div className="form-grid">
          <TextField
            label="Web address"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            hint={`${window.location.origin}/g/${slug || "your-gym"}`}
            error={fieldError("slug")}
          />
          {askOwner && (
            <div className="form-grid form-grid--2">
              <TextField label="GymDesk plan" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Trial, Monthly, Yearly" error={fieldError("saasPlanName")} />
              <TextField label="Valid till" type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} error={fieldError("validTill")} hint="Pauses itself 3 days after this." />
            </div>
          )}
          <div className="form-grid form-grid--2">
            <TextField label="Desk phone" optional type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={fieldError("phone")} />
            <TextField label="Area / address" optional value={address} onChange={(e) => setAddress(e.target.value)} error={fieldError("address")} />
          </div>
        </div>
      )}
      {error && !["name", "slug", "ownerEmail", "phone", "address"].includes(error.field ?? "") && <Notice tone="danger">{error.message}</Notice>}
      <Button type="submit" variant="primary" loading={busy}>
        Create gym
      </Button>
    </form>
  );
}
