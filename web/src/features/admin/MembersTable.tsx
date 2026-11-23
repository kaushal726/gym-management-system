/* Desktop view of the member list: one row per member with plan, end date, days left, dues and status. */
import type { MemberListItem } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { formatMobile } from "../../../../shared/phone.ts";
import { formatDate } from "../../lib/format.ts";
import { navigate } from "../../lib/router.tsx";
import { STATUS_LABEL, STATUS_TONE } from "../../lib/states.ts";
import { BATCH_LABEL } from "../../../../shared/constants.ts";
import { Avatar, Badge, StateBadge } from "../../components/ui/Feedback.tsx";

function daysLeftText(m: MemberListItem): string {
  if (m.status !== "JOINED") return "—";
  if (m.daysLeft != null) return m.daysLeft === 0 ? "Last day" : String(m.daysLeft);
  if (m.daysSinceEnd != null) return `${m.daysSinceEnd} ago`;
  return "—";
}

export function MembersTable({ items, base }: { items: MemberListItem[]; base: string }) {
  return (
    <table className="table table--rows">
      <thead>
        <tr>
          <th>Member</th>
          <th>Mobile</th>
          <th>Batch</th>
          <th>Plan</th>
          <th>Ends</th>
          <th className="num">Days left</th>
          <th className="num">Dues</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((m) => {
          const href = `${base}/members/${m.id}`;
          return (
            <tr key={m.id} onClick={() => navigate(href)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(href)} aria-label={`Open ${m.name}`}>
              <td>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={m.name} src={m.pictureUrl} size={34} />
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                </span>
              </td>
              <td className="tabular muted">{formatMobile(m.phone)}</td>
              <td className="muted">{m.batch ? BATCH_LABEL[m.batch] : "—"}</td>
              <td>{m.planName ?? <span className="muted">—</span>}</td>
              <td className="muted">{m.endDate ? formatDate(m.endDate) : "—"}</td>
              <td className="num tabular">{daysLeftText(m)}</td>
              <td className="num tabular" style={{ color: m.duePaise ? "var(--warning)" : undefined, fontWeight: m.duePaise ? 700 : 400 }}>
                {m.duePaise ? formatRupees(m.duePaise) : "—"}
              </td>
              <td>{m.status === "JOINED" ? <StateBadge state={m.state} /> : <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
