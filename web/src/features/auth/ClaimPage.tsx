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
import { AccountChip } from "../../components/ui/AccountChip.tsx";

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
  const hero = {
    fit: true,
    preview: "member" as const,
    eyebrow: gymName,
    heading: (
      <>
        Hi <em>{memberName.split(" ")[0]}</em>
      </>
    ),
    text: "Your membership is ready. Link your Gmail once and your plan, dues and receipts open on your phone.",
    points: MEMBER_POINTS,
  };
  if (!session?.user) {
    return (
      <AuthLayout {...hero}>
        <SignInCard title="Continue with Google" subtitle="Use the Gmail you want to keep for this gym." />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout {...hero}>
      <div className="card signin enter">
        <div>
          <h2 className="signin__title">Link this Gmail</h2>
          <p className="muted signin__sub">
            {memberName}'s plan at {gymName} will open with this account. Not yours? Switch first.
          </p>
        </div>
        <AccountChip afterSignOut={`/claim/${token}`} />
        {error && <Notice tone="danger">{error}</Notice>}
        <Button variant="primary" block icon={<FiLink />} loading={busy} onClick={() => void link()}>
          Link and continue
        </Button>
      </div>
    </AuthLayout>
  );
}
