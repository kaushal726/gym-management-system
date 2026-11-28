/* The member list inside the platform admin's read-only owner's view: search, a filter dropdown, and the same rows the
 * owner sees. Rows do not open: there is no member page from here. */
import { useEffect, useState } from "react";
import { PiMagnifyingGlassBold, PiUsersThreeDuotone } from "react-icons/pi";
import type { MemberFilter, MemberListItem } from "../../../../shared/api.ts";
import { MEMBER_FILTERS } from "../../../../shared/api.ts";
import { FILTER_LABEL } from "../../../../shared/filters.ts";
import { useApi } from "../../lib/useApi.ts";
import { SelectField } from "../../components/ui/Field.tsx";
import { EmptyState, ErrorState, ListSkeleton } from "../../components/ui/Feedback.tsx";
import { MemberRow } from "../admin/MemberRow.tsx";

const SEARCH_DELAY_MS = 250;
const VISIBLE_FILTERS: MemberFilter[] = MEMBER_FILTERS.filter((f) => f !== "frozen");

export function GymMembersCard({ gymId }: { gymId: string }) {
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), SEARCH_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [query]);
  const { data, error, loading, reload } = useApi<{ items: MemberListItem[]; counts: Record<MemberFilter, number> }>(
    `/platform/gyms/${gymId}/members?filter=${filter}&q=${encodeURIComponent(debounced)}`,
  );

  return (
    <section className="card">
      <div className="card__head">
        <span className="section__title">Members{data ? ` · ${data.counts.all}` : ""}</span>
      </div>
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
        <ListSkeleton rows={4} />
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={<PiUsersThreeDuotone />} title={debounced ? "No match" : "No members here"} text={debounced ? "Try another name or number." : undefined} />
      ) : (
        <div className="list">
          {data?.items.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </div>
      )}
    </section>
  );
}
