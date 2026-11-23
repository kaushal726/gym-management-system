/* The staff app frame: sidebar on desktop; top bar, bottom nav and a "More" sheet on phones. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { FiBarChart2, FiCheckSquare, FiHome, FiLayers, FiLogOut, FiMenu, FiPhoneCall, FiRepeat, FiSettings, FiShield, FiUserCheck, FiUsers } from "react-icons/fi";
import type { GymSettings } from "../../../../shared/api.ts";
import type { StaffRole } from "../../../../shared/constants.ts";
import { syncCheckins } from "../../lib/offlineCheckins.ts";
import { ROLE_LABEL } from "../../lib/states.ts";
import { Link, navigate, usePath } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { useApi } from "../../lib/useApi.ts";
import { Avatar, ErrorState, Skeleton } from "../../components/ui/Feedback.tsx";
import { IconButton } from "../../components/ui/Button.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { useToast } from "../../components/ui/Toast.tsx";

interface AdminContextValue {
  gymId: string;
  role: StaffRole;
  isOwner: boolean;
  gym: GymSettings;
  reloadGym: () => void;
  base: string;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin outside AdminShell");
  return value;
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  ownerOnly?: boolean;
  needsCheckin?: boolean;
  group?: "main" | "manage";
}

function navItems(base: string): NavItem[] {
  return [
    { href: base, label: "Today", icon: <FiHome />, group: "main" },
    { href: `${base}/followups`, label: "Follow-ups", icon: <FiPhoneCall />, group: "main" },
    { href: `${base}/members`, label: "Members", icon: <FiUsers />, group: "main" },
    { href: `${base}/checkins`, label: "Check-ins", icon: <FiCheckSquare />, needsCheckin: true, group: "main" },
    { href: `${base}/plans`, label: "Plans", icon: <FiLayers />, group: "manage" },
    { href: `${base}/reports`, label: "Reports", icon: <FiBarChart2 />, ownerOnly: true, group: "manage" },
    { href: `${base}/staff`, label: "Staff", icon: <FiUserCheck />, ownerOnly: true, group: "manage" },
    { href: `${base}/settings`, label: "Settings", icon: <FiSettings />, ownerOnly: true, group: "manage" },
    { href: `${base}/audit`, label: "Audit log", icon: <FiShield />, ownerOnly: true, group: "manage" },
  ];
}

function isCurrent(path: string, href: string, base: string) {
  return href === base ? path === base : path === href || path.startsWith(`${href}/`);
}

export function AdminShell({ gymId, children }: { gymId: string; children: ReactNode }) {
  const { session, signOut } = useSession();
  const path = usePath();
  const toast = useToast();
  const [moreOpen, setMoreOpen] = useState(false);
  const staff = session?.staffOf.find((s) => s.gymId === gymId);
  const gym = useApi<GymSettings>(staff ? `/gyms/${gymId}/settings` : null);
  const base = `/admin/${gymId}`;

  useEffect(() => {
    const sync = () =>
      void syncCheckins().then((n) => {
        if (n > 0) toast(`${n} offline check-in${n === 1 ? "" : "s"} synced`);
      });
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [toast]);

  if (!staff) {
    return (
      <div className="narrow__body">
        <ErrorState message="You don't have access to this gym." />
      </div>
    );
  }
  if (!gym.data) {
    return (
      <div className="shell">
        <div className="shell__main">
          <div className="page">{gym.error ? <ErrorState message={gym.error.message} onRetry={gym.reload} /> : <Skeleton height={120} radius={12} />}</div>
        </div>
      </div>
    );
  }

  const isOwner = staff.role === "OWNER";
  const items = navItems(base).filter((i) => (!i.ownerOnly || isOwner) && (!i.needsCheckin || gym.data!.checkinEnabled));
  const otherGyms = session!.staffOf.filter((s) => s.gymId !== gymId);
  const bottom = items.slice(0, 3);
  const current = items.find((i) => isCurrent(path, i.href, base));

  return (
    <AdminContext.Provider value={{ gymId, role: staff.role, isOwner, gym: gym.data, reloadGym: gym.reload, base }}>
      <div className="shell">
        <aside className="shell__sidebar" aria-label="Main">
          <div className="brand">
            <img className="brand__mark" src="/icon.svg" alt="" />
            <div style={{ minWidth: 0 }}>
              <div className="brand__name">{gym.data.name}</div>
              <div className="brand__sub">{ROLE_LABEL[staff.role]}</div>
            </div>
          </div>
          <nav className="side-nav">
            {items
              .filter((i) => i.group === "main")
              .map((i) => (
                <Link key={i.href} href={i.href} className="side-nav__item" aria-current={isCurrent(path, i.href, base) ? "page" : undefined}>
                  {i.icon}
                  {i.label}
                </Link>
              ))}
            <span className="side-nav__group">Manage</span>
            {items
              .filter((i) => i.group === "manage")
              .map((i) => (
                <Link key={i.href} href={i.href} className="side-nav__item" aria-current={isCurrent(path, i.href, base) ? "page" : undefined}>
                  {i.icon}
                  {i.label}
                </Link>
              ))}
            {otherGyms.length > 0 && (
              <>
                <span className="side-nav__group">Other gyms</span>
                {otherGyms.map((g) => (
                  <Link key={g.gymId} href={`/admin/${g.gymId}`} className="side-nav__item">
                    <FiRepeat />
                    {g.gymName}
                  </Link>
                ))}
              </>
            )}
          </nav>
          <div className="side-foot">
            <Avatar name={session!.user!.name} src={session!.user!.pictureUrl} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="list-row__title" style={{ fontSize: 13 }}>
                {session!.user!.name}
              </div>
              <div className="list-row__sub" style={{ fontSize: 12 }}>
                {session!.user!.email}
              </div>
            </div>
            <IconButton label="Sign out" icon={<FiLogOut />} onClick={() => void signOut().then(() => navigate("/"))} />
          </div>
        </aside>

        <div className="shell__main">
          <header className="topbar topbar--mobile">
            <img src="/icon.svg" alt="" width={28} height={28} style={{ borderRadius: 8 }} />
            <span className="topbar__title">{current?.label === "Today" || !current ? gym.data.name : current.label}</span>
            <Avatar name={session!.user!.name} src={session!.user!.pictureUrl} size={30} />
          </header>
          <div className="shell__scroll">{children}</div>
          <nav className="bottom-nav" aria-label="Main">
            {bottom.map((i) => (
              <Link key={i.href} href={i.href} className="bottom-nav__item" aria-current={isCurrent(path, i.href, base) ? "page" : undefined}>
                {i.icon}
                {i.label}
              </Link>
            ))}
            <button type="button" className="bottom-nav__item" onClick={() => setMoreOpen(true)} aria-current={current && !bottom.includes(current) ? "page" : undefined}>
              <FiMenu />
              More
            </button>
          </nav>
        </div>
      </div>

      <Sheet open={moreOpen} title="More" onClose={() => setMoreOpen(false)}>
        <div className="list" style={{ margin: "0 -20px" }}>
          {items.slice(3).map((i) => (
            <Link key={i.href} href={i.href} className="list-row" onClick={() => setMoreOpen(false)}>
              {i.icon}
              <span className="list-row__main">
                <span className="list-row__title">{i.label}</span>
              </span>
            </Link>
          ))}
          {otherGyms.map((g) => (
            <Link key={g.gymId} href={`/admin/${g.gymId}`} className="list-row" onClick={() => setMoreOpen(false)}>
              <FiRepeat />
              <span className="list-row__main">
                <span className="list-row__title">Switch to {g.gymName}</span>
              </span>
            </Link>
          ))}
          <button type="button" className="list-row" onClick={() => void signOut().then(() => navigate("/"))}>
            <FiLogOut />
            <span className="list-row__main">
              <span className="list-row__title">Sign out</span>
              <span className="list-row__sub">{session!.user!.email}</span>
            </span>
          </button>
        </div>
      </Sheet>
    </AdminContext.Provider>
  );
}
