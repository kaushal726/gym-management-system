/* Routes. Member pages, the staff app and the platform console share one bundle; staff screens load on demand. */
import { lazy, Suspense, type ReactNode } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { matchPath, usePath } from "./lib/router.tsx";
import { useSession } from "./lib/session.tsx";
import { Button } from "./components/ui/Button.tsx";
import { Skeleton } from "./components/ui/Feedback.tsx";
import { StatusScreen } from "./components/layout/StatusScreen.tsx";
import { HomePage } from "./features/auth/HomePage.tsx";
import { ClaimPage } from "./features/auth/ClaimPage.tsx";
import { JoinPage } from "./features/join/JoinPage.tsx";
import { PosterPage } from "./features/join/PosterPage.tsx";
import { MemberPage } from "./features/member/MemberPage.tsx";
import { SignInCard } from "./features/auth/SignInCard.tsx";
import { AuthLayout } from "./components/layout/AuthLayout.tsx";
import { GYM_POINTS } from "./features/auth/authPoints.tsx";

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

function route(path: string): ReactNode {
  let p: Record<string, string> | null;
  if (path === "/") return <HomePage />;
  if ((p = matchPath("/g/:slug", path))) return <JoinPage slug={p.slug} />;
  if ((p = matchPath("/poster/:slug", path))) return <PosterPage slug={p.slug} />;
  if ((p = matchPath("/claim/:token", path))) return <ClaimPage token={p.token} />;
  if (path === "/me") return <MemberPage />;
  if ((p = matchPath("/me/:gymId", path))) return <MemberPage gymId={p.gymId} />;
  if (path === "/platform") return <PlatformPage />;
  if ((p = matchPath("/platform/gyms/:gymId", path))) return <PlatformGymPage gymId={p.gymId} />;
  if (path === "/new-gym") return <NewGymPage />;
  if (path.startsWith("/admin/")) return <AdminApp path={path} />;
  return <NotFound />;
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
  if (path.startsWith("/admin/") && !session?.user) {
    return (
      <AuthLayout heading="Your gym's desk, on your phone." text="Sign in with the Google account your gym owner added." points={GYM_POINTS}>
        <SignInCard title="Staff sign in" subtitle="Owners, managers and trainers sign in with Google." />
      </AuthLayout>
    );
  }
  // Each page fades in on navigation; the staff app animates its own content so its shell stays put.
  const page = route(path);
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
