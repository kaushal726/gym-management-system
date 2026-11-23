/* Member's own check-in from the QR. The result fills the card in the state's colour so the desk can see it from a distance. */
import { useState } from "react";
import { PiCheckCircleBold, PiClockBold, PiPauseCircleBold, PiWarningCircleBold } from "react-icons/pi";
import type { CheckinResult, PublicGym } from "../../../../shared/api.ts";
import { api, errorMessage } from "../../lib/api.ts";
import { formatDate, formatTime } from "../../lib/format.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Avatar, Notice } from "../../components/ui/Feedback.tsx";

const LOCATION_TIMEOUT_MS = 10_000;

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("Location is not available on this device."));
    else navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Please allow location so we can confirm you are at the gym.")), { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS });
  });
}

const LOOK = {
  ACTIVE: { bg: "var(--success-soft)", fg: "var(--success)", Icon: PiCheckCircleBold, title: "You're in" },
  GRACE: { bg: "var(--warning-soft)", fg: "var(--warning)", Icon: PiClockBold, title: "Renew soon" },
  FROZEN: { bg: "var(--accent-soft)", fg: "var(--accent-soft-text)", Icon: PiPauseCircleBold, title: "Plan is frozen" },
  UPCOMING: { bg: "var(--accent-soft)", fg: "var(--accent-soft-text)", Icon: PiClockBold, title: "Plan not started" },
  EXPIRED: { bg: "var(--danger-soft)", fg: "var(--danger)", Icon: PiWarningCircleBold, title: "Membership expired" },
  NO_PLAN: { bg: "var(--danger-soft)", fg: "var(--danger)", Icon: PiWarningCircleBold, title: "No active plan" },
} as const;

function detail(r: CheckinResult): string {
  switch (r.result) {
    case "ACTIVE":
      return r.endDate ? `Valid till ${formatDate(r.endDate)}` : "Have a great session";
    case "GRACE":
      return `Your plan ended on ${formatDate(r.endDate)}. Please renew at the desk.`;
    case "EXPIRED":
      return `Expired on ${formatDate(r.endDate)}. Please renew at the desk.`;
    case "FROZEN":
      return "Your plan is on hold. Ask the desk to resume it.";
    case "UPCOMING":
      return "Your plan starts later. Please see the desk.";
    case "NO_PLAN":
      return "Please see the desk to start a plan.";
  }
}

export function CheckinPanel({ gym }: { gym: PublicGym }) {
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIn = async () => {
    setBusy(true);
    setError(null);
    try {
      let body: { lat?: number; lng?: number } = {};
      if (gym.checkinNeedsLocation) {
        const p = await position();
        body = { lat: p.coords.latitude, lng: p.coords.longitude };
      }
      setResult(await api.post<CheckinResult>(`/public/gyms/${gym.slug}/checkin`, body));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const look = LOOK[result.result];
    return (
      <div className="card enter" style={{ background: look.bg, borderColor: "transparent", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }} role="status">
        <Avatar name={result.memberName} src={result.pictureUrl} size={88} />
        <look.Icon aria-hidden style={{ width: 40, height: 40, color: look.fg }} />
        <h1 style={{ color: look.fg, fontSize: 28 }}>{look.title}</h1>
        <p style={{ fontWeight: 600 }}>{result.memberName}</p>
        <p className="muted">{detail(result)}</p>
        <p className="muted" style={{ fontSize: 13 }}>
          {result.alreadyToday ? "Already checked in today at " : "Checked in at "}
          {formatTime(result.at)}
        </p>
      </div>
    );
  }
  return (
    <div className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2>Check in</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        Tap when you arrive.{gym.checkinNeedsLocation ? " We check your location once to confirm you are at the gym." : ""}
      </p>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button variant="primary" block loading={busy} onClick={() => void checkIn()} icon={<PiCheckCircleBold />}>
        Check in now
      </Button>
    </div>
  );
}
