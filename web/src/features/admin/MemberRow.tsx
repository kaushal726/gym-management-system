/* One member as a card row: who, how to reach them, plan, when it ends, dues and last visit. Used by Today, Members and search results. */
import type { MemberListItem } from "../../../../shared/api.ts";
import { localToday } from "../../lib/format.ts";
import { Link } from "../../lib/router.tsx";
import { STATUS_LABEL, STATUS_TONE } from "../../lib/states.ts";
import { Avatar, Badge, StateBadge } from "../../components/ui/Feedback.tsx";
import { memberCardLines, type CardText } from "./memberCardLines.ts";

function Line({ line, className }: { line: CardText; className: string }) {
  return <span className={line.tone ? `${className} member-card__${line.tone}` : className}>{line.text}</span>;
}

/** `href` opens the member; without it the row is just shown. */
export function MemberRow({ member, href }: { member: MemberListItem; href?: string }) {
  const lines = memberCardLines(member, localToday());
  const content = (
    <>
      <Avatar name={member.name} src={member.pictureUrl} size={44} />
      <span className="member-card__body">
        <span className="member-card__head">
          <span className="member-card__name">{member.name}</span>
          {member.status === "JOINED" ? <StateBadge state={member.state} /> : <Badge tone={STATUS_TONE[member.status]}>{STATUS_LABEL[member.status]}</Badge>}
        </span>
        <span className="member-card__line tabular">{lines.contact}</span>
        {lines.plan && (
          <span className="member-card__plan">
            {lines.plan}
            {lines.showPt && <Badge tone="accent">PT</Badge>}
          </span>
        )}
        {(lines.validity || lines.aside) && (
          <span className="member-card__foot">
            {lines.validity && <Line line={lines.validity} className="member-card__line" />}
            {lines.aside && <Line line={lines.aside} className="member-card__line member-card__aside" />}
          </span>
        )}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="list-row member-card">
      {content}
    </Link>
  ) : (
    <div className="list-row member-card">{content}</div>
  );
}
