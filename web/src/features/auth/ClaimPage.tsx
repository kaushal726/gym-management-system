/* /claim/:token — links the person's Google account to the membership the desk created for them. */
import { useState } from "react";
import { FiLink, FiSlash } from "react-icons/fi";
import { api, errorMessage } from "../../lib/api.ts";
import { navigate } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { EmptyState, Notice, Skeleton } from "../../components/ui/Feedback.tsx";
import { SignInCard } from "./SignInCard.tsx";

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
    return (
      <NarrowLayout title="Link membership">
        <EmptyState icon={<FiSlash />} title="This link has expired" text={claim.error?.message ?? "Please ask the desk for a new link."} />
      </NarrowLayout>
    );
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
  return (
    <NarrowLayout title={gymName}>
      {!session?.user ? (
        <SignInCard title={`Hi ${memberName.split(" ")[0]}`} subtitle={`Sign in with Google to see your ${gymName} membership, dues and receipts.`} />
      ) : (
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
