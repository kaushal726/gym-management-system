/* Routes. Member pages, the staff app and the platform console share one bundle; staff screens load on demand. */
import { lazy, Suspense, type ReactNode } from "react";
import { FiCompass } from "react-icons/fi";
import { matchPath, usePath } from "./lib/router.tsx";
import { useSession } from "./lib/session.tsx";
import { ButtonLink } from "./components/ui/Button.tsx";
import { EmptyState, ErrorState, Skeleton } from "./components/ui/Feedback.tsx";
import { NarrowLayout } from "./components/layout/NarrowLayout.tsx";
import { HomePage } from "./features/auth/HomePage.tsx";
import { ClaimPage } from "./features/auth/ClaimPage.tsx";
import { JoinPage } from "./features/join/JoinPage.tsx";
import { PosterPage } from "./features/join/PosterPage.tsx";
import { MemberPage } from "./features/member/MemberPage.tsx";
import { SignInCard } from "./features/auth/SignInCard.tsx";

const AdminApp = lazy(() => import("./features/admin/AdminApp.tsx"));
const PlatformPage = lazy(() => import("./features/platform/PlatformPage.tsx").then((m) => ({ default: m.PlatformPage })));
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
  return (
    <NarrowLayout title="GymDesk">
      <EmptyState icon={<FiCompass />} title="Page not found" text="The link may be old or mistyped." action={<ButtonLink href="/">Go home</ButtonLink>} />
    </NarrowLayout>
  );
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
      <NarrowLayout title="GymDesk">
        <ErrorState message={error.message} onRetry={() => void refresh()} />
      </NarrowLayout>
    );
  }
  if (path.startsWith("/admin/") && !session?.user) {
    return (
      <NarrowLayout title="GymDesk">
        <SignInCard title="Staff sign in" subtitle="Use the Google account your gym invited." />
      </NarrowLayout>
    );
  }
  return <Suspense fallback={<Loading />}>{route(path)}</Suspense>;
}
