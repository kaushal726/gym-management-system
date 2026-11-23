/* The staff app's routes, loaded on demand so members never download them. */
import type { ReactNode } from "react";
import { matchPath } from "../../lib/router.tsx";
import { AdminShell } from "./AdminShell.tsx";
import { TodayPage } from "./TodayPage.tsx";
import { FollowupsPage } from "./FollowupsPage.tsx";
import { MembersPage } from "./MembersPage.tsx";
import { MemberDetailPage } from "./MemberDetailPage.tsx";
import { CheckinsPage } from "./CheckinsPage.tsx";
import { PlansPage } from "./PlansPage.tsx";
import { ReportsPage } from "./ReportsPage.tsx";
import { StaffPage } from "./StaffPage.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { AuditPage } from "./AuditPage.tsx";
import { GymQrPage } from "./GymQrPage.tsx";
import { useAdmin } from "./AdminShell.tsx";
import { EmptyState } from "../../components/ui/Feedback.tsx";

const PAGES: Record<string, () => ReactNode> = {
  "": () => <TodayPage />,
  followups: () => <FollowupsPage />,
  members: () => <MembersPage />,
  checkins: () => <CheckinsPage />,
  plans: () => <PlansPage />,
  reports: () => <OwnerOnly><ReportsPage /></OwnerOnly>,
  staff: () => <OwnerOnly><StaffPage /></OwnerOnly>,
  qr: () => <GymQrPage />,
  settings: () => <SettingsPage />,
  audit: () => <OwnerOnly><AuditPage /></OwnerOnly>,
};

function OwnerOnly({ children }: { children: ReactNode }) {
  const { isOwner } = useAdmin();
  return isOwner ? (
    <>{children}</>
  ) : (
    <div className="page">
      <EmptyState art="locked" title="Only the owner can open this" text="Sales, reports, staff and the audit log are for the gym owner." />
    </div>
  );
}

export default function AdminApp({ path }: { path: string }) {
  const detail = matchPath("/admin/:gymId/members/:memberId", path);
  const section = matchPath("/admin/:gymId/:section", path);
  const home = matchPath("/admin/:gymId", path);
  const gymId = detail?.gymId ?? section?.gymId ?? home?.gymId;
  if (!gymId) return null;
  const page = detail ? <MemberDetailPage key={detail.memberId} memberId={detail.memberId} /> : (PAGES[section?.section ?? ""] ?? PAGES[""])();
  return (
    <AdminShell gymId={gymId}>
      <div key={path} className="route-enter">
        {page}
      </div>
    </AdminShell>
  );
}
