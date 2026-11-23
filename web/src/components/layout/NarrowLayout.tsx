/* The member-facing frame: a slim bar with the gym's name and one narrow column. */
import type { ReactNode } from "react";
import { FiLogOut } from "react-icons/fi";
import { useSession } from "../../lib/session.tsx";
import { IconButton } from "../ui/Button.tsx";

export function NarrowLayout({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  const { session, signOut } = useSession();
  return (
    <div className="narrow">
      <header className="narrow__bar">
        <img src="/icon.svg" alt="" width={28} height={28} style={{ borderRadius: 8 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="topbar__title">{title}</div>
          {subtitle && <div className="muted" style={{ fontSize: 12, marginTop: -2 }}>{subtitle}</div>}
        </div>
        {actions}
        {session?.user && <IconButton label="Sign out" icon={<FiLogOut />} onClick={() => void signOut()} />}
      </header>
      <main className="narrow__body">{children}</main>
    </div>
  );
}
