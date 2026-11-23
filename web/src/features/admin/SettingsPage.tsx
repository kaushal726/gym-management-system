/* Gym settings (owner): contact, UPI, grace days, joining fee, reminder time, check-in, and the QR poster. */
import { useEffect, useState } from "react";
import { PiDownloadSimpleBold, PiMapPinBold } from "react-icons/pi";
import type { GymSettings } from "../../../../shared/api.ts";
import { DEFAULT_CHECKIN_RADIUS_M } from "../../../../shared/constants.ts";
import { paiseToInput, rupeesToPaise } from "../../../../shared/money.ts";
import { api, errorField, errorMessage } from "../../lib/api.ts";
import { Button, ButtonLink } from "../../components/ui/Button.tsx";
import { MoneyField, SelectField, Switch, TextField } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";
import { Qr } from "../../components/ui/Qr.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { PushCard } from "../member/PushCard.tsx";
import { useAdmin } from "./AdminShell.tsx";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5);

function hourLabel(h: number): string {
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;
}

export function SettingsPage() {
  const { gymId, base, gym, reloadGym, isOwner } = useAdmin();
  const toast = useToast();
  const [form, setForm] = useState(() => toForm(gym));
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  useEffect(() => setForm(toForm(gym)), [gym]);
  const set = <K extends keyof ReturnType<typeof toForm>>(key: K, value: ReturnType<typeof toForm>[K]) => setForm((f) => ({ ...f, [key]: value }));
  const fieldError = (f: string) => (error?.field === f ? error.message : null);
  const joinUrl = `${window.location.origin}/g/${gym.slug}`;

  const save = async () => {
    const joiningFeePaise = rupeesToPaise(form.joiningFee || "0");
    if (joiningFeePaise == null) {
      setError({ message: "Please enter a valid amount.", field: "joiningFeePaise" });
      return;
    }
    setBusy(true);
    setError(null);
    const body: Omit<GymSettings, "id" | "slug"> = {
      name: form.name,
      phone: form.phone || null,
      address: form.address || null,
      timezone: gym.timezone,
      upiId: form.upiId || null,
      graceDays: Number(form.graceDays) || 0,
      joiningFeePaise,
      checkinEnabled: form.checkinEnabled,
      checkinLat: form.useLocation ? form.lat : null,
      checkinLng: form.useLocation ? form.lng : null,
      checkinRadiusM: form.useLocation ? Number(form.radius) || DEFAULT_CHECKIN_RADIUS_M : null,
      reminderHour: form.reminderHour,
    };
    try {
      await api.patch(`/gyms/${gymId}/settings`, body);
      toast("Settings saved");
      reloadGym();
    } catch (err) {
      setError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  };

  const useHere = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, useLocation: true, lat: p.coords.latitude, lng: p.coords.longitude }));
        setLocating(false);
      },
      () => {
        toast("Couldn't get your location", "error");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>{isOwner ? "Your team can change these too. You get a notification for every change they make." : "The owner gets a notification for every change."}</p>
        </div>
        <Button variant="primary" loading={busy} onClick={() => void save()}>
          Save changes
        </Button>
      </div>
      {error && !error.field && <Notice tone="danger">{error.message}</Notice>}

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card card--pad form-grid">
            <h2>Gym</h2>
            <TextField label="Gym name" value={form.name} onChange={(e) => set("name", e.target.value)} error={fieldError("name")} />
            <div className="form-grid form-grid--2">
              <TextField label="Desk phone" optional type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={fieldError("phone")} hint="Members can call or WhatsApp this number." />
              <TextField label="UPI ID" optional value={form.upiId} onChange={(e) => set("upiId", e.target.value)} placeholder="gymname@okaxis" error={fieldError("upiId")} hint="Shown with a QR when a member has dues." />
            </div>
            <TextField label="Address" optional value={form.address} onChange={(e) => set("address", e.target.value)} error={fieldError("address")} />
          </section>

          <section className="card card--pad form-grid">
            <h2>Rules</h2>
            <div className="form-grid form-grid--2">
              <TextField label="Grace days after expiry" type="number" inputMode="numeric" min={0} max={30} value={form.graceDays} onChange={(e) => set("graceDays", e.target.value)} error={fieldError("graceDays")} hint="Allowed in, shown in amber." />
              <MoneyField label="Joining fee" value={form.joiningFee} onChange={(e) => set("joiningFee", e.target.value)} error={fieldError("joiningFeePaise")} hint="Charged on the first membership only." />
            </div>
            <SelectField label="Daily reminders at" value={form.reminderHour} onChange={(e) => set("reminderHour", Number(e.target.value))} hint="Expiry, dues and follow-up list are prepared at this time.">
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </SelectField>
          </section>

          <section className="card card--pad form-grid">
            <h2>Check-in</h2>
            <Switch checked={form.checkinEnabled} onChange={(v) => set("checkinEnabled", v)} label="Members check in with the QR" hint="Expired members see a red screen at the entrance." />
            {form.checkinEnabled && (
              <>
                <Switch checked={form.useLocation} onChange={(v) => set("useLocation", v)} label="Must be at the gym" hint="Stops check-ins from a photo of the QR at home." />
                {form.useLocation && (
                  <div className="form-grid form-grid--2">
                    <Button icon={<PiMapPinBold />} loading={locating} onClick={useHere}>
                      {form.lat != null ? "Location saved · update" : "Use my current location"}
                    </Button>
                    <TextField label="Radius (metres)" type="number" inputMode="numeric" min={30} max={5000} value={form.radius} onChange={(e) => set("radius", e.target.value)} error={fieldError("checkinRadiusM")} />
                  </div>
                )}
                {form.useLocation && form.lat == null && <Notice tone="warning">Stand inside the gym and tap the button to save its location.</Notice>}
              </>
            )}
          </section>
          <div className="card card--pad">
            <Button variant="primary" block loading={busy} onClick={() => void save()}>
              Save changes
            </Button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
            <h2>Your gym's QR code</h2>
            <Qr text={joinUrl} size={200} label="QR code to join this gym" />
            <p className="muted" style={{ fontSize: 13, overflowWrap: "anywhere" }}>
              {joinUrl}
            </p>
            <p className="muted" style={{ fontSize: 13 }}>
              New members sign up with it{gym.checkinEnabled ? ", and members check in with it" : ""}. Put it at the desk and the entrance.
            </p>
            <ButtonLink href={`${base}/qr`} icon={<PiDownloadSimpleBold />}>
              Download or print QR
            </ButtonLink>
          </section>
          <PushCard compact />
        </div>
      </div>
    </div>
  );
}

function toForm(g: GymSettings) {
  return {
    name: g.name,
    phone: g.phone ?? "",
    address: g.address ?? "",
    upiId: g.upiId ?? "",
    graceDays: String(g.graceDays),
    joiningFee: paiseToInput(g.joiningFeePaise),
    reminderHour: g.reminderHour,
    checkinEnabled: g.checkinEnabled,
    useLocation: g.checkinLat != null,
    lat: g.checkinLat,
    lng: g.checkinLng,
    radius: String(g.checkinRadiusM ?? DEFAULT_CHECKIN_RADIUS_M),
  };
}
