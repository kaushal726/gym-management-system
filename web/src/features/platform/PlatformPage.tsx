/* /platform — the SaaS console for the platform admin: every gym, and onboarding a new one. */
import { useState } from "react";
import { FiExternalLink, FiGrid, FiPlus } from "react-icons/fi";
import type { PlatformGym } from "../../../../shared/api.ts";
import { formatDateTime } from "../../lib/format.ts";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { Link } from "../../lib/router.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { EmptyState, ErrorState, ListSkeleton } from "../../components/ui/Feedback.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { GymCreateForm } from "./GymCreateForm.tsx";

export function PlatformPage() {
  const { session, refresh } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ items: PlatformGym[] }>(session?.isPlatformAdmin ? "/platform/gyms" : null);
  const [creating, setCreating] = useState(false);

  if (!session?.isPlatformAdmin) {
    return (
      <NarrowLayout title="Platform">
        <EmptyState icon={<FiGrid />} title="Not available" text="This page is only for the platform admin." />
      </NarrowLayout>
    );
  }
  return (
    <NarrowLayout title="Platform" subtitle="All gyms">
      <div className="page-head">
        <h1>Gyms</h1>
        <Button variant="primary" icon={<FiPlus />} onClick={() => setCreating(true)}>
          New gym
        </Button>
      </div>
      <div className="card">
        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton rows={3} />
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={<FiGrid />} title="No gyms yet" text="Create the first gym and invite its owner." />
        ) : (
          <div className="list">
            {data?.items.map((g) => (
              <div className="list-row" key={g.id}>
                <span className="list-row__main">
                  <span className="list-row__title">{g.name}</span>
                  <span className="list-row__sub">
                    /g/{g.slug} · {g.memberCount} members · {g.ownerEmails.join(", ") || "no owner"}
                  </span>
                  <span className="list-row__sub">Created {formatDateTime(g.createdAt)}</span>
                </span>
                {session.staffOf.some((s) => s.gymId === g.id) && (
                  <Link href={`/admin/${g.id}`} aria-label={`Open ${g.name}`}>
                    <FiExternalLink />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Sheet open={creating} title="New gym" description="The owner gets access when they sign in with this Google email." onClose={() => setCreating(false)}>
        <GymCreateForm
          endpoint="/platform/gyms"
          askOwner
          onCreated={() => {
            setCreating(false);
            toast("Gym created");
            reload();
            void refresh();
          }}
        />
      </Sheet>
    </NarrowLayout>
  );
}
