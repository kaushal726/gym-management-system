/* Members: a filter dropdown (same rules as the dashboard counts), search by name or phone, add a walk-in. */
import { useEffect, useState } from "react";
import { PiMagnifyingGlassBold, PiPlusBold, PiUsersThreeDuotone } from "react-icons/pi";
import type { MemberFilter, MemberListItem } from "../../../../shared/api.ts";
import { MEMBER_FILTERS } from "../../../../shared/api.ts";
import { FILTER_LABEL } from "../../../../shared/filters.ts";
import { localToday } from "../../lib/format.ts";
import { navigate, useQueryParam } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { Button } from "../../components/ui/Button.tsx";
import { SelectField } from "../../components/ui/Field.tsx";
import { EmptyState, ErrorState, ListSkeleton } from "../../components/ui/Feedback.tsx";
import { useAdmin } from "./AdminShell.tsx";
import { MemberFormSheet } from "./MemberFormSheet.tsx";
import { MemberRow } from "./MemberRow.tsx";
import { MembersTable } from "./MembersTable.tsx";

const SEARCH_DELAY_MS = 250;
const VISIBLE_FILTERS: MemberFilter[] = MEMBER_FILTERS.filter((f) => f !== "frozen");

export function MembersPage() {
  const { gymId, base, gym } = useAdmin();
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
        <div className="page-head__actions">
          <Button variant="primary" icon={<PiPlusBold />} onClick={() => navigate(`${base}/members?add=1`)}>
            Add member
          </Button>
        </div>
      </div>

      <div className="card">
        <div className="card__bar card__bar--tools">
          <div className="input-affix">
            <PiMagnifyingGlassBold className="input-affix__prefix" aria-hidden />
            <input className="input" type="search" placeholder="Search name or mobile" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
          </div>
          <SelectField label="Show" value={filter} onChange={(e) => setFilter(e.target.value as MemberFilter)}>
            {VISIBLE_FILTERS.map((f) => (
              <option key={f} value={f}>
                {FILTER_LABEL[f]}
                {data ? ` (${data.counts[f]})` : ""}
              </option>
            ))}
          </SelectField>
        </div>
        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton rows={6} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={<PiUsersThreeDuotone />}
            title={debounced ? "No match" : filter === "all" ? "No members yet" : `No ${FILTER_LABEL[filter].toLowerCase()} members`}
            text={debounced ? "Try another name or number." : filter === "all" ? "Add your first member, or put the QR code on the wall so people can sign up." : undefined}
            action={
              filter === "all" && !debounced ? (
                <Button variant="primary" icon={<PiPlusBold />} onClick={() => navigate(`${base}/members?add=1`)}>
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


      <MemberFormSheet
        open={addOpen}
        gymId={gymId}
        today={localToday()}
        batches={gym.batches}
        onClose={() => navigate(`${base}/members${filter === "all" ? "" : `?filter=${filter}`}`, { replace: true })}
        onSaved={(id) => navigate(`${base}/members/${id}?activate=1`)}
      />
    </div>
  );
}
