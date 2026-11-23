/* / — sends each person where they belong: the desk app, their membership, or the platform console. */
import type { ReactNode } from "react";
import { FiArrowRight, FiBriefcase, FiGrid, FiPlusCircle, FiUser } from "react-icons/fi";
import { Link, Redirect } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";
import { SignInCard } from "./SignInCard.tsx";

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
      <NarrowLayout title="GymDesk">
        <div className="center-screen">
          <div className="enter" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <img src="/icon.svg" alt="" width={56} height={56} style={{ borderRadius: 16 }} />
            <h1 style={{ fontSize: 30, marginTop: 8 }}>Renewals, dues and reminders. Sorted.</h1>
            <p className="muted">Members join from a QR code, the desk activates them in one step, and reminders go out on their own.</p>
          </div>
          <SignInCard title="Sign in" subtitle="Gym owners, staff and members all sign in with Google." />
        </div>
      </NarrowLayout>
    );
  }

  const destinations: Destination[] = [
    ...session.staffOf.map((s) => ({ href: `/admin/${s.gymId}`, title: s.gymName, sub: s.role === "OWNER" ? "Owner" : "Manager", icon: <FiBriefcase /> })),
    ...(session.memberOf.length ? [{ href: "/me", title: "My membership", sub: session.memberOf.map((m) => m.gymName).join(", "), icon: <FiUser /> }] : []),
    ...(session.isPlatformAdmin ? [{ href: "/platform", title: "Platform", sub: "All gyms", icon: <FiGrid /> }] : []),
    ...(config?.allowGymSignup || session.isPlatformAdmin ? [{ href: "/new-gym", title: "Create a gym", sub: "Set up your own gym", icon: <FiPlusCircle /> }] : []),
  ];
  const real = destinations.filter((d) => d.href !== "/new-gym");
  if (real.length === 1 && !session.isPlatformAdmin) return <Redirect to={real[0].href} />;

  return (
    <NarrowLayout title="GymDesk">
      <h1>Hi, {session.user.name.split(" ")[0]}</h1>
      {destinations.length === 0 ? (
        <Notice tone="info">You are not part of a gym yet. To join one, scan the QR code at its desk.</Notice>
      ) : (
        <div className="card list enter-stagger">
          {destinations.map((d) => (
            <Link key={d.href} href={d.href} className="list-row">
              <span className="state-box__icon" style={{ width: 40, height: 40 }} aria-hidden>
                {d.icon}
              </span>
              <span className="list-row__main">
                <span className="list-row__title">{d.title}</span>
                <span className="list-row__sub">{d.sub}</span>
              </span>
              <FiArrowRight aria-hidden className="muted" />
            </Link>
          ))}
        </div>
      )}
    </NarrowLayout>
  );
}
