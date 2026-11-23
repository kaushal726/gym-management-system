/* Members: filter chips (same rules as the dashboard counts), search by name or phone, add a walk-in. */
import { useEffect, useState } from "react";
import { FiPlus, FiSearch, FiUsers } from "react-icons/fi";
import type { MemberFilter, MemberListItem } from "../../../../shared/api.ts";
import { MEMBER_FILTERS } from "../../../../shared/api.ts";
import { FILTER_LABEL } from "../../../../shared/filters.ts";
import { localToday } from "../../lib/format.ts";
import { navigate, useQueryParam } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { Button } from "../../components/ui/Button.tsx";
import { EmptyState, ErrorState, ListSkeleton } from "../../components/ui/Feedback.tsx";
import { useAdmin } from "./AdminShell.tsx";
import { MemberFormSheet } from "./MemberFormSheet.tsx";
import { MemberRow } from "./MemberRow.tsx";
import { MembersTable } from "./MembersTable.tsx";

const SEARCH_DELAY_MS = 250;
const VISIBLE_FILTERS: MemberFilter[] = MEMBER_FILTERS.filter((f) => f !== "frozen");

export function MembersPage() {
  const { gymId, base } = useAdmin();
  const filterParam = useQueryParam("filter");
  const filter: MemberFilter = (MEMBER_FILTERS as readonly string[]).includes(filterParam ?? "") ? (filterParam as MemberFilter) : "all";
  const addOpen = useQueryParam("add") === "1";
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), SEARCH_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data, error, loading, reload } = useApi<{ items: MemberListItem[]; counts: Record<MemberFilter, number> }>(
    `/gyms/${gymId}/members?filter=${filter}&q=${encodeURIComponent(debounced)}`,
  );
  const setFilter = (f: MemberFilter) => navigate(f === "all" ? `${base}/members` : `${base}/members?filter=${f}`, { replace: true });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Members</h1>
          <p>{data ? `${data.counts.all} people` : " "}</p>
        </div>
        <div className="page-head__actions hide-mobile">
          <Button variant="primary" icon={<FiPlus />} onClick={() => navigate(`${base}/members?add=1`)}>
            Add member
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="input-affix">
          <FiSearch className="input-affix__prefix" aria-hidden />
          <input className="input" type="search" placeholder="Search name or mobile" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
        </div>
        <div className="chips" role="toolbar" aria-label="Filter members">
          {VISIBLE_FILTERS.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {FILTER_LABEL[f]}
              {data && <span className="chip__count">{data.counts[f]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton rows={6} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={<FiUsers />}
            title={debounced ? "No match" : filter === "all" ? "No members yet" : `No ${FILTER_LABEL[filter].toLowerCase()} members`}
            text={debounced ? "Try another name or number." : filter === "all" ? "Add your first member, or put the QR code on the wall so people can sign up." : undefined}
            action={
              filter === "all" && !debounced ? (
                <Button variant="primary" icon={<FiPlus />} onClick={() => navigate(`${base}/members?add=1`)}>
                  Add member
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="list only-phone">
              {data?.items.map((m) => (
                <MemberRow key={m.id} member={m} href={`${base}/members/${m.id}`} />
              ))}
            </div>
            <div className="only-desktop">
              <MembersTable items={data?.items ?? []} base={base} />
            </div>
          </>
        )}
      </div>

      <Button variant="primary" className="fab" icon={<FiPlus />} onClick={() => navigate(`${base}/members?add=1`)}>
        Add
      </Button>

      <MemberFormSheet
        open={addOpen}
        gymId={gymId}
        today={localToday()}
        onClose={() => navigate(`${base}/members${filter === "all" ? "" : `?filter=${filter}`}`, { replace: true })}
        onSaved={(id) => navigate(`${base}/members/${id}?activate=1`)}
      />
    </div>
  );
}
