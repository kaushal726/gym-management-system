/* / — signed out: what GymDesk is and the sign-in. Signed in: straight to the one place this account belongs,
 * a short chooser when there are several, or a clear "no gym on this Gmail" with the account shown. */
import type { ReactNode } from "react";
import { PiArrowRightBold, PiBriefcaseBold, PiIdentificationBadgeDuotone, PiPlusCircleBold, PiQrCodeDuotone, PiStorefrontDuotone, PiUserBold } from "react-icons/pi";
import { Link, Redirect } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { ROLE_LABEL } from "../../lib/states.ts";
import { AuthLayout, BRAND_HEADING } from "../../components/layout/AuthLayout.tsx";
import { AccountChip } from "../../components/ui/AccountChip.tsx";
import { Illustration } from "../../components/ui/Illustration.tsx";
import { SignInCard } from "./SignInCard.tsx";
import { GYM_POINTS } from "./authPoints.tsx";

/** The three reasons a gym owner signs up, as chips under the headline. */
const SELLING_POINTS = ["QR join", "WhatsApp reminders", "Free to start"];

/** What to do when a Gmail has no gym, for each kind of person. */
const NEXT_STEPS = [
  { who: "Gym owner", what: "Ask GymDesk to onboard your gym with this Gmail.", icon: <PiStorefrontDuotone /> },
  { who: "Manager or trainer", what: "Ask your gym owner to add this Gmail under Staff.", icon: <PiIdentificationBadgeDuotone /> },
  { who: "Member", what: "Scan the QR code at your gym's desk.", icon: <PiQrCodeDuotone /> },
];

interface Destination {
  href: string;
  title: string;
  sub: string;
  icon: ReactNode;
}

export function HomePage() {
  const { session, config } = useSession();
  if (!session?.user) {
    return (
      <AuthLayout
        heading={BRAND_HEADING}
        text="Never miss a renewal. Never lose a due."
        chips={SELLING_POINTS}
        fit
        points={GYM_POINTS}
      >
        <SignInCard title="Sign in" subtitle="Gym owners, staff and members all sign in with Google." />
      </AuthLayout>
    );
  }

  // The platform admin's home is the console; gyms are reached from there, never mixed in.
  if (session.isPlatformAdmin) return <Redirect to="/platform" />;

  const destinations: Destination[] = [
    ...session.staffOf.map((s) => ({ href: `/admin/${s.gymId}`, title: s.gymName, sub: `${ROLE_LABEL[s.role]} · open the desk`, icon: <PiBriefcaseBold /> })),
    ...(session.memberOf.length ? [{ href: "/me", title: "My membership", sub: session.memberOf.map((m) => m.gymName).join(", "), icon: <PiUserBold /> }] : []),
    ...(config?.allowGymSignup ? [{ href: "/new-gym", title: "Create a gym", sub: "Set up your own gym", icon: <PiPlusCircleBold /> }] : []),
  ];
  const real = destinations.filter((d) => d.href !== "/new-gym");
  if (real.length === 1) return <Redirect to={real[0].href} />;

  const first = session.user.name.split(" ")[0];
  const none = destinations.length === 0;
  return (
    <AuthLayout
      heading={
        <>
          Hi <em>{first}</em>
        </>
      }
      text={none ? "This Gmail isn't linked to a gym yet." : "Pick up where you left off."}
      points={GYM_POINTS}
      fit
      noArt
    >
      {none ? (
        <div className="card card--pad home-card home-card--list">
          <div className="home-empty">
            <Illustration kind="lost" size={72} />
            <div>
              <h2>No gym here yet</h2>
              <p className="muted">Here's how to get in.</p>
            </div>
          </div>
          <ul className="home-steps">
            {NEXT_STEPS.map((s) => (
              <li key={s.who}>
                <span className="home-link__icon" aria-hidden>
                  {s.icon}
                </span>
                <span className="list-row__main">
                  <span className="list-row__title">{s.who}</span>
                  <span className="list-row__sub home-steps__what">{s.what}</span>
                </span>
              </li>
            ))}
          </ul>
          <AccountChip />
        </div>
      ) : (
        <div className="card card--pad home-card home-card--list">
          <h2>Where to?</h2>
          <div className="home-list enter-stagger">
            {destinations.map((d) => (
              <Link key={d.href} href={d.href} className="home-link">
                <span className="home-link__icon" aria-hidden>
                  {d.icon}
                </span>
                <span className="list-row__main">
                  <span className="list-row__title">{d.title}</span>
                  <span className="list-row__sub">{d.sub}</span>
                </span>
                <PiArrowRightBold aria-hidden className="home-link__arrow" />
              </Link>
            ))}
          </div>
          <AccountChip />
        </div>
      )}
    </AuthLayout>
  );
}
