/* Frame for the member, platform and join screens. Desktop: a sidebar with the places this account can open and
 * the account at the bottom. Phone: a plain header (logo + title) and bottom tabs, with sign-out under Account.
 * Sign-out never sits in the header. Signed out, it is just the plain header and the page. */
import { useState, type ReactNode } from "react";
import { PiBarbellBold, PiBuildingsBold, PiHouseBold, PiSignOutBold, PiStorefrontBold, PiUserCircleBold } from "react-icons/pi";
import { Link, navigate, usePath } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { BrandMark } from "../ui/Brand.tsx";
import { Button, IconButton } from "../ui/Button.tsx";
import { Avatar } from "../ui/Feedback.tsx";
import { MadeBy } from "../ui/MadeBy.tsx";
import { Sheet } from "../ui/Sheet.tsx";

/** Phones show this many places as tabs, then the Account tab. */
const MAX_PLACE_TABS = 3;

interface Place {
  href: string;
  label: string;
  icon: ReactNode;
  current: (path: string) => boolean;
}

function usePlaces(): Place[] {
  const { session } = useSession();
  if (!session?.user) return [];
  const places: Place[] = [];
  if (session.memberOf.length > 0) places.push({ href: "/me", label: "My plan", icon: <PiBarbellBold />, current: (p) => p === "/me" || p.startsWith("/me/") });
  for (const s of session.staffOf) {
    const href = `/admin/${s.gymId}`;
    places.push({ href, label: session.staffOf.length === 1 ? "Gym desk" : s.gymName, icon: <PiStorefrontBold />, current: (p) => p.startsWith(href) });
  }
  if (session.isPlatformAdmin) places.push({ href: "/platform", label: "Gyms", icon: <PiBuildingsBold />, current: (p) => p.startsWith("/platform") });
  // Home only helps when there is a choice to make; with one place it just leads back to it.
  const home: Place = { href: "/", label: "Home", icon: <PiHouseBold />, current: (p) => p === "/" };
  return places.length === 1 ? places : [home, ...places];
}

interface NarrowLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  /** A welcome block at the very top. When given there is no header bar: the hero is the top of the page. */
  hero?: ReactNode;
}

export function NarrowLayout({ title, subtitle, children, actions, wide, hero }: NarrowLayoutProps) {
  const { session, signOut } = useSession();
  const path = usePath();
  const places = usePlaces();
  const [accountOpen, setAccountOpen] = useState(false);
  const user = session?.user;
  const leave = () => void signOut().then(() => navigate("/"));
  const tabs = places.slice(0, MAX_PLACE_TABS);

  return (
    <div className="shell">
      {user && (
        <aside className="shell__sidebar" aria-label="Main">
          <div className="brand">
            <BrandMark size={36} />
            <div style={{ minWidth: 0 }}>
              <div className="brand__name">GymDesk</div>
              <div className="brand__sub">{title}</div>
            </div>
          </div>
          <nav className="side-nav">
            {places.map((p) => (
              <Link key={p.href} href={p.href} className="side-nav__item" aria-current={p.current(path) ? "page" : undefined}>
                {p.icon}
                {p.label}
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            <Avatar name={user.name} src={user.pictureUrl} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="list-row__title" style={{ fontSize: 13 }}>
                {user.name}
              </div>
              <div className="list-row__sub" style={{ fontSize: 12 }}>
                {user.email}
              </div>
            </div>
            <IconButton label="Sign out" icon={<PiSignOutBold />} onClick={leave} />
          </div>
        </aside>
      )}

      <div className="shell__main">
        {!hero && (
          <header className={user ? "topbar topbar--mobile" : "topbar"}>
            <BrandMark size={32} />
            <span className="topbar__center">
              <span className="topbar__title">{title}</span>
              {subtitle && <span className="topbar__sub">{subtitle}</span>}
            </span>
          </header>
        )}
        <div className={user ? "shell__scroll" : "shell__scroll shell__scroll--plain"}>
          {hero}
          <main className={wide ? "narrow__body narrow__body--wide" : "narrow__body"}>
            {actions && <div className="narrow__tools">{actions}</div>}
            {children}
          </main>
          <MadeBy />
        </div>
        {user && (
          <nav className="bottom-nav" aria-label="Main" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, 1fr)` }}>
            {tabs.map((p) => (
              <Link key={p.href} href={p.href} className="bottom-nav__item" aria-current={p.current(path) ? "page" : undefined}>
                {p.icon}
                {p.label}
              </Link>
            ))}
            <button type="button" className="bottom-nav__item" onClick={() => setAccountOpen(true)}>
              <PiUserCircleBold />
              Account
            </button>
          </nav>
        )}
      </div>

      {user && (
        <Sheet open={accountOpen} title="Account" onClose={() => setAccountOpen(false)}>
          <div className="form-grid">
            <div className="status__account">
              <Avatar name={user.name} src={user.pictureUrl} size={40} />
              <span style={{ flex: 1 }}>
                <small>Signed in as</small>
                <strong>{user.email}</strong>
              </span>
            </div>
            {places.slice(MAX_PLACE_TABS).map((p) => (
              <Link key={p.href} href={p.href} className="list-row" onClick={() => setAccountOpen(false)}>
                {p.icon}
                <span className="list-row__main">
                  <span className="list-row__title">{p.label}</span>
                </span>
              </Link>
            ))}
            <Button variant="danger-ghost" block icon={<PiSignOutBold />} onClick={leave}>
              Sign out
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
