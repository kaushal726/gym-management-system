/* /g/:slug — the page behind the gym's QR code. One QR for everything: sign in, register, wait at the desk, check in. */
import { FiArrowRight, FiMapPin, FiSlash } from "react-icons/fi";
import type { GymEntry } from "../../../../shared/api.ts";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { ButtonLink } from "../../components/ui/Button.tsx";
import { Avatar, EmptyState, ErrorState, Notice, Skeleton } from "../../components/ui/Feedback.tsx";
import { SignInCard } from "../auth/SignInCard.tsx";
import { RegisterForm } from "./RegisterForm.tsx";
import { CheckinPanel } from "./CheckinPanel.tsx";

export function JoinPage({ slug }: { slug: string }) {
  const { session } = useSession();
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
    return (
      <NarrowLayout title="GymDesk">
        {missing ? <EmptyState icon={<FiSlash />} title="Gym not found" text="This QR code may be old. Please ask the desk for the current one." /> : <ErrorState message={entry.error?.message} onRetry={entry.reload} />}
      </NarrowLayout>
    );
  }

  const { gym, member } = entry.data;
  return (
    <NarrowLayout title={gym.name} subtitle={gym.address ?? undefined}>
      {!session?.user ? (
        <SignInCard title={`Welcome to ${gym.name}`} subtitle="Sign in with Google to join, see your plan and get renewal reminders." />
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
          {gym.checkinEnabled && <CheckinPanel gym={gym} />}
          <ButtonLink href={`/me/${gym.id}`} variant={gym.checkinEnabled ? "secondary" : "primary"} block icon={<FiArrowRight />}>
            View my membership
          </ButtonLink>
        </>
      )}
      {gym.address && (
        <p className="muted" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, justifyContent: "center" }}>
          <FiMapPin aria-hidden /> {gym.address}
        </p>
      )}
    </NarrowLayout>
  );
}
