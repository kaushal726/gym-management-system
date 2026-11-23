/* / — signed out: what GymDesk is and the sign-in. Signed in: straight to the one place this account belongs,
 * a short chooser when there are several, or a clear "no gym on this Gmail" with the account shown. */
import type { ReactNode } from "react";
import { FiArrowRight, FiBriefcase, FiPlusCircle, FiUser } from "react-icons/fi";
import { Link, Redirect } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { ROLE_LABEL } from "../../lib/states.ts";
import { AuthLayout } from "../../components/layout/AuthLayout.tsx";
import { AccountChip } from "../../components/ui/AccountChip.tsx";
import { Illustration } from "../../components/ui/Illustration.tsx";
import { SignInCard } from "./SignInCard.tsx";
import { GYM_POINTS } from "./authPoints.tsx";

/** What to do when a Gmail has no gym, for each kind of person. */
const NEXT_STEPS = [
  { who: "Gym owner", what: "Ask GymDesk to onboard your gym with this Gmail." },
  { who: "Manager or trainer", what: "Ask your gym owner to add this Gmail under Staff." },
  { who: "Member", what: "Scan the QR code at your gym's desk." },
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
        heading={
          <>
            Run your gym from your <em>phone.</em>
          </>
        }
        text="Renewals, dues and reminders, sorted. Built for Indian gyms, free to run."
        points={GYM_POINTS}
      >
        <SignInCard title="Sign in" subtitle="Gym owners, staff and members all sign in with Google." />
      </AuthLayout>
    );
  }

  // The platform admin's home is the console; gyms are reached from there, never mixed in.
  if (session.isPlatformAdmin) return <Redirect to="/platform" />;

  const destinations: Destination[] = [
    ...session.staffOf.map((s) => ({ href: `/admin/${s.gymId}`, title: s.gymName, sub: `${ROLE_LABEL[s.role]} · open the desk`, icon: <FiBriefcase /> })),
    ...(session.memberOf.length ? [{ href: "/me", title: "My membership", sub: session.memberOf.map((m) => m.gymName).join(", "), icon: <FiUser /> }] : []),
    ...(config?.allowGymSignup ? [{ href: "/new-gym", title: "Create a gym", sub: "Set up your own gym", icon: <FiPlusCircle /> }] : []),
  ];
  const real = destinations.filter((d) => d.href !== "/new-gym");
  if (real.length === 1) return <Redirect to={real[0].href} />;

  const first = session.user.name.split(" ")[0];
  const none = destinations.length === 0;
  return (
    <AuthLayout
      heading={`Hi ${first}, good to see you.`}
      text={none ? "This Gmail isn't linked to a gym yet. Here's how to get in." : "Pick up where you left off. Everything for your gym is one tap away."}
      points={GYM_POINTS}
    >
      {destinations.length === 0 ? (
        <div className="card card--pad home-card">
          <Illustration kind="lost" size={140} />
          <h2>No gym on this Gmail yet</h2>
          <ul className="home-steps">
            {NEXT_STEPS.map((s) => (
              <li key={s.who}>
                <strong>{s.who}</strong>
                <span>{s.what}</span>
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
                <FiArrowRight aria-hidden className="home-link__arrow" />
              </Link>
            ))}
          </div>
          <AccountChip />
        </div>
      )}
    </AuthLayout>
  );
}
