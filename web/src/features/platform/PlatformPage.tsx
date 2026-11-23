/* /platform — the SaaS console. Every gym with its health (never its money), filters by plan state,
 * and onboarding a new gym with its one owner. */
import { useState } from "react";
import { FiAlertTriangle, FiGrid, FiPlus } from "react-icons/fi";
import type { PlatformGym } from "../../../../shared/api.ts";
import { GYM_ACCESS_LABEL, type GymAccess } from "../../../../shared/saas.ts";
import { formatDate } from "../../lib/format.ts";
import { Link, navigate } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Badge, EmptyState, ErrorState, ListSkeleton } from "../../components/ui/Feedback.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import type { Tone } from "../../lib/states.ts";
import { GymCreateForm } from "./GymCreateForm.tsx";
import { StatusScreen } from "../../components/layout/StatusScreen.tsx";

export const ACCESS_TONE: Record<GymAccess, Tone> = { ACTIVE: "success", EXPIRING: "warning", GRACE: "warning", PAUSED: "danger", ARCHIVED: "neutral" };

type Filter = "all" | "attention" | GymAccess;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs attention" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
];

function matches(g: PlatformGym, f: Filter): boolean {
  if (f === "all") return g.access !== "ARCHIVED";
  if (f === "attention") return g.access === "EXPIRING" || g.access === "GRACE" || g.access === "PAUSED";
  if (f === "ACTIVE") return g.access === "ACTIVE" || g.access === "EXPIRING" || g.access === "GRACE";
  return g.access === f;
}

export function PlatformPage() {
  const { session, refresh } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ items: PlatformGym[] }>(session?.isPlatformAdmin ? "/platform/gyms" : null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  if (!session?.isPlatformAdmin) {
    return <StatusScreen art="locked" title="This page is for GymDesk admins" text="Gym owners and staff manage their gym from the gym's own page." />;
  }
  const items = data?.items ?? [];
  const count = (f: Filter) => items.filter((g) => matches(g, f)).length;
  const list = items.filter((g) => matches(g, filter));
  const totalActiveMembers = items.filter((g) => g.access !== "ARCHIVED").reduce((n, g) => n + g.activeMembers, 0);

  return (
    <NarrowLayout title="GymDesk Platform" subtitle={session.user?.email} wide>
      <div className="page-head">
        <div>
          <h1>Gyms</h1>
          <p>Onboard gyms, track their GymDesk plan, pause or archive them.</p>
        </div>
        <Button variant="primary" icon={<FiPlus />} onClick={() => setCreating(true)}>
          Onboard gym
        </Button>
      </div>

      {data && (
        <div className="stats enter-stagger">
          <div className="stat">
            <span className="stat__label">Gyms</span>
            <span className="stat__value">{count("all")}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Needs attention</span>
            <span className="stat__value" style={{ color: count("attention") ? "var(--warning)" : undefined }}>
              {count("attention")}
            </span>
            <span className="stat__hint">Expiring, in grace or paused</span>
          </div>
          <div className="stat">
            <span className="stat__label">Paused</span>
            <span className="stat__value">{count("PAUSED")}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Active members</span>
            <span className="stat__value">{totalActiveMembers}</span>
            <span className="stat__hint">Across all gyms</span>
          </div>
        </div>
      )}

      <div className="chips" role="toolbar" aria-label="Filter gyms">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" className="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
            {data && <span className="chip__count">{count(f.value)}</span>}
          </button>
        ))}
      </div>

      <div className="card">
        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton rows={3} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<FiGrid />}
            title={items.length === 0 ? "No gyms yet" : "Nothing here"}
            text={items.length === 0 ? "Onboard the first gym with its owner's Gmail." : undefined}
            action={
              items.length === 0 ? (
                <Button variant="primary" icon={<FiPlus />} onClick={() => setCreating(true)}>
                  Onboard gym
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="list">
            {list.map((g) => (
              <Link key={g.id} href={`/platform/gyms/${g.id}`} className="list-row">
                <span className="list-row__main">
                  <span className="list-row__title">{g.name}</span>
                  <span className="list-row__sub">{g.ownerEmail ?? "No owner"}</span>
                  <span className="list-row__sub">
                    {g.activeMembers} active of {g.members} members{g.pending ? ` · ${g.pending} pending` : ""}
                  </span>
                </span>
                <span className="list-row__end">
                  <Badge tone={ACCESS_TONE[g.access]}>{GYM_ACCESS_LABEL[g.access]}</Badge>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {g.validTill ? `till ${formatDate(g.validTill)}` : "No end date"}
                  </span>
                  {g.ownerEmail === session.user?.email && (
                    <span style={{ fontSize: 12, color: "var(--warning)", display: "flex", gap: 4, alignItems: "center" }}>
                      <FiAlertTriangle aria-hidden /> Owner is you
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Sheet open={creating} title="Onboard a gym" description="Only the owner's Gmail can open the gym. Your platform email can't own one." onClose={() => setCreating(false)}>
        <GymCreateForm
          endpoint="/platform/gyms"
          askOwner
          onCreated={(id) => {
            setCreating(false);
            toast("Gym onboarded");
            void refresh();
            navigate(`/platform/gyms/${id}`);
          }}
        />
      </Sheet>
    </NarrowLayout>
  );
}
