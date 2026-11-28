/* Lets a person turn on reminders on this device, with the iPhone "Add to Home Screen" step explained. */
import { useEffect, useState } from "react";
import { PiBellBold, PiBellSlashBold, PiExportBold } from "react-icons/pi";
import { errorMessage } from "../../lib/api.ts";
import { pushStatus, turnOffPush, turnOnPush, type PushStatus } from "../../lib/push.ts";
import { useSession } from "../../lib/session.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";

/** The reminder switch for this device. One instance per screen, so a page can place the card by its state. */
export function usePush() {
  const { config } = useSession();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void pushStatus().then(setStatus);
  }, []);

  const available = status != null && status !== "unsupported" && !!config?.vapidPublicKey;
  const toggle = async () => {
    if (!config?.vapidPublicKey) return;
    setBusy(true);
    setError(null);
    try {
      setStatus(status === "on" ? await turnOffPush() : await turnOnPush(config.vapidPublicKey));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return { status, available, busy, error, toggle };
}

export type PushControl = ReturnType<typeof usePush>;

/** With `push` the page owns the switch (and can move the card); without it the card manages itself. */
export function PushCard({ compact = false, quiet = false, push }: { compact?: boolean; quiet?: boolean; push?: PushControl }) {
  const own = usePush();
  const { status, available, busy, error, toggle } = push ?? own;
  if (!available || status == null) return null;

  if (quiet) {
    return (
      <div className="push-quiet">
        <PiBellBold aria-hidden />
        <span>Reminders are on</span>
        <button type="button" onClick={() => void toggle()} disabled={busy}>
          Turn off
        </button>
      </div>
    );
  }

  return (
    <div className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="state-box__icon" style={{ width: 40, height: 40 }} aria-hidden>
          {status === "on" ? <PiBellBold /> : <PiBellSlashBold />}
        </span>
        <div style={{ flex: 1 }}>
          <h3>{status === "on" ? "Reminders are on" : "Get reminders"}</h3>
          {!compact && <p className="muted" style={{ fontSize: 13 }}>Before your plan ends and when a payment is pending.</p>}
        </div>
        {(status === "on" || status === "off") && (
          <Button size="sm" variant={status === "on" ? "ghost" : "primary"} loading={busy} onClick={() => void toggle()}>
            {status === "on" ? "Turn off" : "Turn on"}
          </Button>
        )}
      </div>
      {status === "needs-install" && (
        <Notice tone="info">
          On iPhone, tap <PiExportBold aria-label="Share" style={{ verticalAlign: "-2px" }} /> Share, then <strong>Add to Home Screen</strong>. Open the app from there to turn on reminders.
        </Notice>
      )}
      {status === "denied" && <Notice tone="warning">Notifications are blocked for this site. Allow them in your browser settings to get reminders.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
