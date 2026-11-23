/* The member-facing frame: a slim bar with the gym's name and one narrow column. */
import type { ReactNode } from "react";
import { PiSignOutBold } from "react-icons/pi";
import { useSession } from "../../lib/session.tsx";
import { IconButton } from "../ui/Button.tsx";
import { BrandMark } from "../ui/Brand.tsx";

export function NarrowLayout({ title, subtitle, children, actions, wide }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  const { session, signOut } = useSession();
  return (
    <div className="narrow">
      <header className="narrow__bar">
        <BrandMark size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="topbar__title">{title}</div>
          {subtitle && <div className="muted" style={{ fontSize: 12, marginTop: -2 }}>{subtitle}</div>}
        </div>
        {actions}
        {session?.user && <IconButton label="Sign out" icon={<PiSignOutBold />} onClick={() => void signOut()} />}
      </header>
      <main className={wide ? "narrow__body narrow__body--wide" : "narrow__body"}>{children}</main>
    </div>
  );
}
