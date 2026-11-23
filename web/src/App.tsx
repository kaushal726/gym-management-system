/* Routes. Member pages, the staff app and the platform console share one bundle; staff screens load on demand. */
import { lazy, Suspense, type ReactNode } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { matchPath, usePath } from "./lib/router.tsx";
import { useSession } from "./lib/session.tsx";
import { Button } from "./components/ui/Button.tsx";
import { Skeleton } from "./components/ui/Feedback.tsx";
import { StatusScreen } from "./components/layout/StatusScreen.tsx";
import { Protected, type Guard } from "./components/layout/Protected.tsx";
import { HomePage } from "./features/auth/HomePage.tsx";
import { ClaimPage } from "./features/auth/ClaimPage.tsx";
import { JoinPage } from "./features/join/JoinPage.tsx";
import { PosterPage } from "./features/join/PosterPage.tsx";
import { MemberPage } from "./features/member/MemberPage.tsx";

const AdminApp = lazy(() => import("./features/admin/AdminApp.tsx"));
const PlatformPage = lazy(() => import("./features/platform/PlatformPage.tsx").then((m) => ({ default: m.PlatformPage })));
const PlatformGymPage = lazy(() => import("./features/platform/PlatformGymPage.tsx").then((m) => ({ default: m.PlatformGymPage })));
const NewGymPage = lazy(() => import("./features/platform/NewGymPage.tsx").then((m) => ({ default: m.NewGymPage })));

function Loading() {
  return (
    <div className="narrow__body" aria-busy="true">
      <Skeleton width="40%" height={24} />
      <Skeleton height={120} radius={12} />
      <Skeleton height={64} radius={12} />
    </div>
  );
}

function NotFound() {
  return <StatusScreen art="lost" title="This page wandered off" text="The link may be old or mistyped. Let's get you back." />;
}

interface RouteDef {
  pattern: string;
  /** Who may open it. See Protected for what each guard means. */
  guard: Guard;
  render: (params: Record<string, string>, path: string) => ReactNode;
}

/** Every page and its guard, in one table. "/admin/*" matches everything under /admin/. */
const ROUTES: RouteDef[] = [
  { pattern: "/", guard: "public", render: () => <HomePage /> },
  { pattern: "/g/:slug", guard: "public", render: (p) => <JoinPage slug={p.slug} /> },
  { pattern: "/poster/:slug", guard: "public", render: (p) => <PosterPage slug={p.slug} /> },
  { pattern: "/claim/:token", guard: "public", render: (p) => <ClaimPage token={p.token} /> },
  { pattern: "/me", guard: "member", render: () => <MemberPage /> },
  { pattern: "/me/:gymId", guard: "member", render: (p) => <MemberPage gymId={p.gymId} /> },
  { pattern: "/platform", guard: "platform", render: () => <PlatformPage /> },
  { pattern: "/platform/gyms/:gymId", guard: "platform", render: (p) => <PlatformGymPage gymId={p.gymId} /> },
  { pattern: "/new-gym", guard: "gymSignup", render: () => <NewGymPage /> },
  { pattern: "/admin/*", guard: "staff", render: (_p, path) => <AdminApp path={path} /> },
];

function resolve(path: string): { route: RouteDef; params: Record<string, string> } | null {
  for (const route of ROUTES) {
    if (route.pattern.endsWith("/*")) {
      if (path.startsWith(route.pattern.slice(0, -1))) return { route, params: {} };
      continue;
    }
    const params = matchPath(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}

export function App() {
  const { loading, error, session, refresh } = useSession();
  const path = usePath();
  if (loading) return <Loading />;
  if (error && !session) {
    return (
      <StatusScreen
        art="lost"
        title="Couldn't reach GymDesk"
        text={error.message}
        hideHome
        actions={
          <Button variant="primary" icon={<FiRefreshCw />} onClick={() => void refresh()}>
            Try again
          </Button>
        }
      />
    );
  }
  const match = resolve(path);
  // Each page fades in on navigation; the staff app animates its own content so its shell stays put.
  const page = match ? <Protected guard={match.route.guard}>{match.route.render(match.params, path)}</Protected> : <NotFound />;
  return (
    <Suspense fallback={<Loading />}>
      {path.startsWith("/admin/") ? (
        page
      ) : (
        <div key={path} className="route-enter" style={{ height: "100%" }}>
          {page}
        </div>
      )}
    </Suspense>
  );
}
