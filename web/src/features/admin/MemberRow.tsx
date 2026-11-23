/* One member in a list: who, plan state, days left, dues. Used by Today, Members and search results. */
import type { MemberListItem } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { formatMobile } from "../../../../shared/phone.ts";
import { formatDayMonth, plural } from "../../lib/format.ts";
import { Link } from "../../lib/router.tsx";
import { STATUS_LABEL, STATUS_TONE } from "../../lib/states.ts";
import { Avatar, Badge, StateBadge } from "../../components/ui/Feedback.tsx";

function subline(m: MemberListItem): string {
  if (m.status === "PENDING") return `Request${m.requestNo != null ? ` #${m.requestNo}` : ""} · ${formatMobile(m.phone)}`;
  if (m.status !== "JOINED") return formatMobile(m.phone);
  const plan = m.planName ?? "No plan";
  if (m.state === "ACTIVE" || m.state === "FROZEN") return `${plan} · ${m.daysLeft === 0 ? "last day" : `${plural(m.daysLeft ?? 0, "day")} left`}`;
  if (m.state === "GRACE" || m.state === "EXPIRED") return `${plan} · ended ${formatDayMonth(m.endDate)}`;
  if (m.state === "UPCOMING") return `${plan} · starts soon`;
  return formatMobile(m.phone);
}

export function MemberRow({ member, href }: { member: MemberListItem; href: string }) {
  return (
    <Link href={href} className="list-row">
      <Avatar name={member.name} src={member.pictureUrl} />
      <span className="list-row__main">
        <span className="list-row__title">{member.name}</span>
        <span className="list-row__sub">{subline(member)}</span>
      </span>
      <span className="list-row__end">
        {member.status === "JOINED" ? <StateBadge state={member.state} /> : <Badge tone={STATUS_TONE[member.status]}>{STATUS_LABEL[member.status]}</Badge>}
        {member.duePaise > 0 && (
          <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: "var(--warning)" }}>
            {formatRupees(member.duePaise)} due
          </span>
        )}
      </span>
    </Link>
  );
}
