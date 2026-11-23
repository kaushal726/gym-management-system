/* Google sign-in, with a local-only sign-in for development when DEV_AUTH=1. */
import { useEffect, useRef, useState } from "react";
import { FiLock } from "react-icons/fi";
import { api, errorMessage } from "../../lib/api.ts";
import { renderGoogleButton } from "../../lib/google.ts";
import { useSession } from "../../lib/session.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { TextField } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";

export function SignInCard({ title, subtitle }: { title: string; subtitle?: string }) {
  const { config, refresh } = useSession();
  const buttonBox = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const clientId = config?.googleClientId;
    if (!clientId || !buttonBox.current) return;
    renderGoogleButton(buttonBox.current, clientId, async (credential) => {
      setBusy(true);
      setError(null);
      try {
        await api.post("/auth/google", { credential });
        await refresh();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    }).catch((err: Error) => setError(err.message));
  }, [config?.googleClientId, refresh]);

  return (
    <div className="card card--pad enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted" style={{ marginTop: 6 }}>{subtitle}</p>}
      </div>
      {config?.googleClientId ? (
        <div ref={buttonBox} className="google-button" aria-busy={busy} />
      ) : (
        !config?.devLogin && <Notice tone="warning">Google sign-in is not set up yet. Please ask the gym.</Notice>
      )}
      {config?.devLogin && <DevSignIn onDone={refresh} />}
      {error && <Notice tone="danger">{error}</Notice>}
      <p className="muted" style={{ display: "flex", gap: 8, fontSize: 13 }}>
        <FiLock aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />
        We only see your name, email and profile picture. We never read your Gmail.
      </p>
    </div>
  );
}

function DevSignIn({ onDone }: { onDone: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signIn = async (address: string) => {
    setBusy(true);
    setError(null);
    try {
      const name = address
        .split("@")[0]
        .split(/[._-]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      await api.post("/auth/dev", { email: address, name });
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void signIn(email);
      }}
    >
      <Notice tone="info">Local test sign-in, only for made-up @gymdesk.test emails. It does not exist on the live site.</Notice>
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@gymdesk.test" autoComplete="email" required />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" variant="primary" loading={busy} block>
        Sign in
      </Button>
    </form>
  );
}
