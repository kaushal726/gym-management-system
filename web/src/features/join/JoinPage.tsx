/* /g/:slug — the page behind the gym's QR code. One QR for everything: sign in, register, wait at the desk, check in. */
import { FiArrowRight, FiRefreshCw, FiSlash } from "react-icons/fi";
import type { GymEntry } from "../../../../shared/api.ts";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { ButtonLink } from "../../components/ui/Button.tsx";
import { Avatar, EmptyState, Notice, Skeleton } from "../../components/ui/Feedback.tsx";
import { SignInCard } from "../auth/SignInCard.tsx";
import { StatusScreen } from "../../components/layout/StatusScreen.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { AuthLayout } from "../../components/layout/AuthLayout.tsx";
import { MEMBER_POINTS } from "../auth/authPoints.tsx";
import { RegisterForm } from "./RegisterForm.tsx";
import { CheckinPanel } from "./CheckinPanel.tsx";

export function JoinPage({ slug }: { slug: string }) {
  const { session, signOut } = useSession();
  // The user id in the query (ignored by the API) makes the entry reload when someone signs in or out.
  const userId = session?.user?.id ?? "anon";
  const entry = useApi<GymEntry>(`/public/gyms/${slug}?u=${userId}`);

  if (entry.loading && !entry.data) {
    return (
      <NarrowLayout title="Loading…">
        <div className="card card--pad" style={{ display: "grid", gap: 12 }}>
          <Skeleton width="60%" height={24} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      </NarrowLayout>
    );
  }
  if (entry.error || !entry.data) {
    const missing = (entry.error as { status?: number } | null)?.status === 404;
    return missing ? (
      <StatusScreen art="lost" title="We couldn't find this gym" text="This QR code may be old. Please ask the desk for the current one." />
    ) : (
      <StatusScreen
        art="lost"
        title="Couldn't load this page"
        text={entry.error?.message ?? "Please try again."}
        actions={
          <Button variant="primary" icon={<FiRefreshCw />} onClick={entry.reload}>
            Try again
          </Button>
        }
      />
    );
  }

  const { gym, member } = entry.data;
  if (!session?.user) {
    return (
      <AuthLayout preview="member" eyebrow={gym.address ?? undefined} heading={`Welcome to ${gym.name}`} text="Join in a minute, see your plan and get renewal reminders on your phone." points={MEMBER_POINTS}>
        <SignInCard title="Continue with Google" subtitle="New here or already a member, start by signing in." />
      </AuthLayout>
    );
  }
  const heading = !member ? `Join ${gym.name}` : member.status === "JOINED" ? `Welcome back, ${member.name.split(" ")[0]}` : gym.name;
  return (
    <AuthLayout
      preview="member"
      eyebrow={gym.address ?? undefined}
      heading={heading}
      text="Your plan, dues and receipts on your phone, and a reminder before your plan ends."
      points={MEMBER_POINTS}
      below={
        <p className="auth__account">
          {session.user.email} ·{" "}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void signOut()}>
            Sign out
          </button>
        </p>
      }
    >
      {!member && !gym.open ? (
        <EmptyState icon={<FiSlash />} title="Not taking sign-ups right now" text="Please contact the gym's desk." />
      ) : !member ? (
        <RegisterForm slug={slug} gymName={gym.name} onDone={entry.reload} />
      ) : member.status === "PENDING" || member.status === "LEAD" ? (
        <div className="card enter" style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <Avatar name={member.name} src={session.user.pictureUrl} size={96} />
          <div>
            <h1 style={{ fontSize: 26 }}>{member.name}</h1>
            {member.requestNo != null && (
              <p className="tabular" style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, color: "var(--accent-strong)", lineHeight: 1.1, marginTop: 6 }}>
                #{member.requestNo}
              </p>
            )}
          </div>
          <Notice tone="info">Show this screen at the desk. They will pick your plan and take the payment.</Notice>
        </div>
      ) : member.status === "REJECTED" ? (
        <EmptyState icon={<FiSlash />} title="Please see the desk" text="Your request could not be accepted. The desk can help you." />
      ) : (
        <>
          {gym.checkinEnabled && gym.open && <CheckinPanel gym={gym} />}
          <ButtonLink href={`/me/${gym.id}`} variant={gym.checkinEnabled ? "secondary" : "primary"} block icon={<FiArrowRight />}>
            View my membership
          </ButtonLink>
        </>
      )}
    </AuthLayout>
  );
}
