/* The staff app frame: sidebar on desktop; top bar, bottom nav and a "More" sheet on phones. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PiArrowsClockwiseBold, PiBuildingsBold, PiChartBarBold, PiCheckSquareBold, PiGearSixBold, PiHouseBold, PiListBold, PiPhoneCallBold, PiPlusBold, PiQrCodeBold, PiRepeatBold, PiShieldCheckBold, PiSignOutBold, PiStackBold, PiUserCheckBold, PiUsersThreeBold } from "react-icons/pi";
import type { GymSettings } from "../../../../shared/api.ts";
import type { StaffRole } from "../../../../shared/constants.ts";
import { syncCheckins } from "../../lib/offlineCheckins.ts";
import { ROLE_LABEL } from "../../lib/states.ts";
import { Link, navigate, usePath } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { useApi } from "../../lib/useApi.ts";
import { Avatar, Notice, Skeleton } from "../../components/ui/Feedback.tsx";
import { Button, ButtonLink, IconButton } from "../../components/ui/Button.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { BrandMark } from "../../components/ui/Brand.tsx";
import { StatusScreen } from "../../components/layout/StatusScreen.tsx";
import { ApiRequestError } from "../../lib/api.ts";
import { formatDate } from "../../lib/format.ts";
import { gymIsOpen, SAAS_GRACE_DAYS, type GymAccess } from "../../../../shared/saas.ts";
import type { StaffGym } from "../../../../shared/api.ts";

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
    { href: base, label: "Today", icon: <PiHouseBold />, group: "main" },
    { href: `${base}/followups`, label: "Follow-ups", icon: <PiPhoneCallBold />, group: "main" },
    { href: `${base}/members`, label: "Members", icon: <PiUsersThreeBold />, group: "main" },
    { href: `${base}/checkins`, label: "Check-ins", icon: <PiCheckSquareBold />, needsCheckin: true, group: "main" },
    { href: `${base}/plans`, label: "Plans", icon: <PiStackBold />, group: "manage" },
    { href: `${base}/qr`, label: "Gym QR", icon: <PiQrCodeBold />, group: "manage" },
    { href: `${base}/reports`, label: "Reports", icon: <PiChartBarBold />, ownerOnly: true, group: "manage" },
    { href: `${base}/staff`, label: "Staff", icon: <PiUserCheckBold />, ownerOnly: true, group: "manage" },
    { href: `${base}/settings`, label: "Settings", icon: <PiGearSixBold />, group: "manage" },
    { href: `${base}/audit`, label: "Audit log", icon: <PiShieldCheckBold />, ownerOnly: true, group: "manage" },
  ];
}

function isCurrent(path: string, href: string, base: string) {
  return href === base ? path === base : path === href || path.startsWith(`${href}/`);
}

/** The owner's reminder that the gym's own GymDesk plan is ending or has just ended. */
function PlanBanner({ access, validTill }: { access: GymAccess; validTill: string | null }) {
  return (
    <div className="page" style={{ paddingBottom: 0 }}>
      <Notice tone="warning">
        {access === "GRACE"
          ? `Your GymDesk plan ended on ${formatDate(validTill)}. The desk will pause ${SAAS_GRACE_DAYS} days after that. Please renew with GymDesk.`
          : `Your GymDesk plan ends on ${formatDate(validTill)}. Please renew to keep the desk running without a break.`}
      </Notice>
    </div>
  );
}

/** Buttons to the other gyms this person works at, if any. */
function otherGymButtons(staffOf: StaffGym[], gymId: string) {
  const others = staffOf.filter((s) => s.gymId !== gymId && gymIsOpen(s.access));
  if (others.length === 0) return undefined;
  return (
    <>
      {others.map((g) => (
        <ButtonLink key={g.gymId} href={`/admin/${g.gymId}`} variant="primary" icon={<PiRepeatBold />}>
          Open {g.gymName}
        </ButtonLink>
      ))}
    </>
  );
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
      <StatusScreen
        art="locked"
        title="You're not on this gym's team"
        text="This Gmail isn't added to this gym. Ask the gym owner to add it under Staff, or sign in with the Gmail they added."
        actions={
          session?.isPlatformAdmin ? (
            <ButtonLink href="/platform" variant="primary" icon={<PiBuildingsBold />}>
              Open platform console
            </ButtonLink>
          ) : (
            otherGymButtons(session?.staffOf ?? [], gymId)
          )
        }
      />
    );
  }
  const pausedByServer = gym.error instanceof ApiRequestError && gym.error.code === "GYM_PAUSED";
  if (!gymIsOpen(staff.access) || pausedByServer) {
    return (
      <StatusScreen
        art="sleeping"
        title={staff.access === "ARCHIVED" ? `${staff.gymName} is closed on GymDesk` : `${staff.gymName} is paused`}
        text="Members can still see their own plans. To get the desk running again, please contact GymDesk support."
        actions={otherGymButtons(session!.staffOf, gymId)}
      />
    );
  }
  if (gym.error && !gym.data) {
    return (
      <StatusScreen
        art="lost"
        title="Couldn't open the gym"
        text={gym.error.message}
        actions={
          <Button variant="primary" icon={<PiArrowsClockwiseBold />} onClick={gym.reload}>
            Try again
          </Button>
        }
      />
    );
  }
  if (!gym.data) {
    return (
      <div className="shell">
        <div className="shell__main">
          <div className="page">
            <Skeleton width={180} height={28} />
            <Skeleton height={120} radius={12} />
          </div>
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
            <BrandMark size={36} />
            <div style={{ minWidth: 0 }}>
              <div className="brand__name">{gym.data.name}</div>
              <div className="brand__sub">{ROLE_LABEL[staff.role]}</div>
            </div>
          </div>
          <ButtonLink href={`${base}/members?add=1`} variant="accent" block icon={<PiPlusBold />}>
            Add member
          </ButtonLink>
          <nav className="side-nav" style={{ marginTop: 16 }}>
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
                    <PiRepeatBold />
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
            <IconButton label="Sign out" icon={<PiSignOutBold />} onClick={() => void signOut().then(() => navigate("/"))} />
          </div>
        </aside>

        <div className="shell__main">
          <header className="topbar topbar--mobile">
            <BrandMark size={32} />
            <span className="topbar__center">
              <span className="topbar__title">{gym.data.name}</span>
              <span className="topbar__sub">{ROLE_LABEL[staff.role]}</span>
            </span>
          </header>
          <div className="shell__scroll">
            {isOwner && (staff.access === "EXPIRING" || staff.access === "GRACE") && <PlanBanner access={staff.access} validTill={staff.validTill} />}
            {children}
          </div>
          <nav className="bottom-nav" aria-label="Main">
            {bottom.map((i) => (
              <Link key={i.href} href={i.href} className="bottom-nav__item" aria-current={isCurrent(path, i.href, base) ? "page" : undefined}>
                {i.icon}
                {i.label}
              </Link>
            ))}
            <button type="button" className="bottom-nav__item" onClick={() => setMoreOpen(true)} aria-current={current && !bottom.includes(current) ? "page" : undefined}>
              <PiListBold />
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
              <PiRepeatBold />
              <span className="list-row__main">
                <span className="list-row__title">Switch to {g.gymName}</span>
              </span>
            </Link>
          ))}
          <button type="button" className="list-row" onClick={() => void signOut().then(() => navigate("/"))}>
            <PiSignOutBold />
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
