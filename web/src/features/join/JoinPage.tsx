/* /g/:slug — the page behind the gym's QR code. One QR for everything: sign in, register, wait at the desk, check in. */
import { PiArrowRightBold, PiArrowsClockwiseBold, PiProhibitDuotone } from "react-icons/pi";
import type { GymEntry } from "../../../../shared/api.ts";
import { BATCH_LABEL } from "../../../../shared/constants.ts";
import { useGymBrand } from "../../lib/brand.ts";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { ButtonLink } from "../../components/ui/Button.tsx";
import { Avatar, EmptyState, Skeleton } from "../../components/ui/Feedback.tsx";
import { SignInCard } from "../auth/SignInCard.tsx";
import { StatusScreen } from "../../components/layout/StatusScreen.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { AuthLayout } from "../../components/layout/AuthLayout.tsx";
import { MEMBER_POINTS } from "../auth/authPoints.tsx";
import { initials } from "../../lib/format.ts";
import { RegisterForm } from "./RegisterForm.tsx";
import { AccountChip } from "../../components/ui/AccountChip.tsx";
import { CheckinPanel } from "./CheckinPanel.tsx";

/** The name on the desk pass shrinks as it gets longer, so a long name stays on a few lines and no word is cut. */
function deskPassNameSize(name: string): number {
  const length = name.trim().length;
  return length <= 16 ? 44 : length <= 28 ? 34 : 26;
}

export function JoinPage({ slug }: { slug: string }) {
  const { session } = useSession();
  // The user id in the query (ignored by the API) makes the entry reload when someone signs in or out.
  const userId = session?.user?.id ?? "anon";
  const entry = useApi<GymEntry>(`/public/gyms/${slug}?u=${userId}`);
  useGymBrand(entry.data?.gym.id);

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
          <Button variant="primary" icon={<PiArrowsClockwiseBold />} onClick={entry.reload}>
            Try again
          </Button>
        }
      />
    );
  }

  const { gym, member } = entry.data;
  if (!session?.user) {
    return (
      <AuthLayout
        preview="member"
        eyebrow={null}
        heading={<em>{gym.name}</em>}
        text="Join in a minute. Your plan, dues and receipts stay on your phone."
        chips={[gym.address, gym.batches.map((b) => BATCH_LABEL[b]).join(" · ")].filter((c): c is string => !!c)}
        points={MEMBER_POINTS}
        poweredBy
        monogram={initials(gym.name)}
        titleLength={gym.name.length}
        fit
      >
        <SignInCard title="Continue with Google" subtitle="New here or already a member, start by signing in." />
      </AuthLayout>
    );
  }
  const heading = !member ? `Join ${gym.name}` : member.status === "JOINED" ? `Hi, ${member.name.split(" ")[0]}` : gym.name;
  const waiting = member != null && (member.status === "PENDING" || member.status === "LEAD");
  const text = waiting ? "You're on the list. The desk will start your plan." : "Your plan, dues and receipts on your phone, and a reminder before your plan ends.";
  return (
    <AuthLayout
      preview="member"
      eyebrow={null}
      heading={heading}
      text={text}
      points={MEMBER_POINTS}
      fit={member != null}
      noArt
      below={<AccountChip afterSignOut={`/g/${slug}`} />}
    >
      {!member && !gym.open ? (
        <div className="card">
          <EmptyState icon={<PiProhibitDuotone />} title="Not taking sign-ups right now" text="Please contact the gym's desk." />
        </div>
      ) : !member ? (
        <RegisterForm slug={slug} gymName={gym.name} batches={gym.batches} onDone={entry.reload} />
      ) : member.status === "PENDING" || member.status === "LEAD" ? (
        <div className="card desk-pass enter">
          <span className="desk-pass__tag">Request sent</span>
          <Avatar name={member.name} src={session.user.pictureUrl} size={88} />
          <h1 className="desk-pass__name" style={{ fontSize: deskPassNameSize(member.name) }}>
            {member.name}
          </h1>
          <p className="desk-pass__gym">{gym.name}</p>
          <p className="desk-pass__note">Show this screen at the desk. They will pick your plan and take the payment.</p>
        </div>
      ) : member.status === "REJECTED" ? (
        <div className="card">
          <EmptyState icon={<PiProhibitDuotone />} title="Please see the desk" text="Your request could not be accepted. The desk can help you." />
        </div>
      ) : (
        <div className="card card--pad form-grid">
          {gym.checkinEnabled && gym.open && <CheckinPanel gym={gym} />}
          <ButtonLink href={`/me/${gym.id}`} variant={gym.checkinEnabled ? "secondary" : "primary"} block icon={<PiArrowRightBold />}>
            View my membership
          </ButtonLink>
        </div>
      )}
    </AuthLayout>
  );
}
