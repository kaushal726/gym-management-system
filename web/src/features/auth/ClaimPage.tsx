/* /claim/:token — links the person's Google account to the membership the desk created for them. */
import { useState } from "react";
import { FiLink } from "react-icons/fi";
import { api, errorMessage } from "../../lib/api.ts";
import { navigate } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Notice, Skeleton } from "../../components/ui/Feedback.tsx";
import { SignInCard } from "./SignInCard.tsx";
import { StatusScreen } from "../../components/layout/StatusScreen.tsx";
import { AuthLayout } from "../../components/layout/AuthLayout.tsx";
import { MEMBER_POINTS } from "./authPoints.tsx";

export function ClaimPage({ token }: { token: string }) {
  const { session, refresh } = useSession();
  const claim = useApi<{ gymName: string; gymSlug: string; memberName: string }>(`/public/claim/${token}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (claim.loading) {
    return (
      <NarrowLayout title="Link membership">
        <Skeleton height={180} radius={12} />
      </NarrowLayout>
    );
  }
  if (claim.error || !claim.data) {
    return <StatusScreen art="locked" title="This link has expired" text="Links work once and for 7 days. Please ask the desk to send a new one on WhatsApp." />;
  }
  const { gymName, memberName } = claim.data;
  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ ok: true; gymId: string }>(`/public/claim/${token}`);
      await refresh();
      navigate(`/me/${res.gymId}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  if (!session?.user) {
    return (
      <AuthLayout preview="member" eyebrow={gymName} heading={`Hi ${memberName.split(" ")[0]}, your membership is ready.`} text="Sign in once and your plan, dues and receipts are always on your phone." points={MEMBER_POINTS}>
        <SignInCard title="Continue with Google" subtitle="Use the Gmail you want to keep for this gym." />
      </AuthLayout>
    );
  }
  return (
    <NarrowLayout title={gymName}>
      {(
        <div className="card card--pad form-grid enter">
          <span className="state-box__icon" aria-hidden>
            <FiLink />
          </span>
          <h1>Link your membership</h1>
          <p className="muted">
            This connects the membership of <strong>{memberName}</strong> at {gymName} to {session.user.email}.
          </p>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button variant="primary" block loading={busy} onClick={() => void link()}>
            Link and continue
          </Button>
        </div>
      )}
    </NarrowLayout>
  );
}
