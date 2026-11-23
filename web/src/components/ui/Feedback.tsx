import type { CSSProperties, ReactNode } from "react";
import { PiArrowsClockwiseBold, PiCheckCircleBold, PiInfoBold, PiWarningBold, PiWarningCircleBold } from "react-icons/pi";
import type { MembershipState } from "../../../../shared/membership.ts";
import { initials } from "../../lib/format.ts";
import { STATE_LABEL, STATE_TONE, type Tone } from "../../lib/states.ts";
import { Button } from "./Button.tsx";
import { Illustration, type IllustrationKind } from "./Illustration.tsx";

export function Skeleton({ width = "100%", height = 16, radius, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) {
  return <span className="skeleton" aria-hidden style={{ width, height, borderRadius: radius, ...style }} />;
}

/** A list-shaped placeholder: avatar + two lines per row. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div className="list-row" key={i}>
          <Skeleton width={40} height={40} radius={20} />
          <div className="list-row__main" style={{ gap: 6 }}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="70%" height={12} />
          </div>
          <Skeleton width={56} height={20} radius={10} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, art, title, text, action }: { icon?: ReactNode; art?: IllustrationKind; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="state-box enter">
      {art ? (
        <Illustration kind={art} size={132} />
      ) : (
        <span className="state-box__icon" aria-hidden>
          {icon}
        </span>
      )}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state-box enter" role="alert">
      <span className="state-box__icon state-box__icon--danger" aria-hidden>
        <PiWarningCircleBold />
      </span>
      <h3>Couldn't load this</h3>
      <p>{message ?? "Something went wrong. Please try again."}</p>
      {onRetry && (
        <Button size="sm" icon={<PiArrowsClockwiseBold />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const NOTICE_ICON = { info: PiInfoBold, warning: PiWarningBold, danger: PiWarningCircleBold, success: PiCheckCircleBold } as const;

export function Notice({ tone = "info", children }: { tone?: keyof typeof NOTICE_ICON; children: ReactNode }) {
  const Icon = NOTICE_ICON[tone];
  return (
    <div className={`notice notice--${tone}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function StateBadge({ state }: { state: MembershipState }) {
  return <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>;
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" /> : initials(name)}
    </span>
  );
}
