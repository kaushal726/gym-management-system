/* One full-page screen for "you can't be here" moments: no access, page or gym not found, paused gym,
 * expired link, load errors. Always says who is signed in and offers a way out. */
import type { ReactNode } from "react";
import { FiHome, FiLogOut } from "react-icons/fi";
import { navigate } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { Button } from "../ui/Button.tsx";
import { AccountChip } from "../ui/AccountChip.tsx";
import { Illustration, type IllustrationKind } from "../ui/Illustration.tsx";

interface Props {
  art: IllustrationKind;
  title: string;
  text: string;
  /** Extra buttons or links, shown before the standard ones. */
  actions?: ReactNode;
  /** Hide "Go home" when home is where the problem is. */
  hideHome?: boolean;
}

export function StatusScreen({ art, title, text, actions, hideHome }: Props) {
  const { session, signOut } = useSession();
  const user = session?.user;
  return (
    <div className="status">
      <header className="status__bar">
        <img src="/icon.svg" alt="" width={28} height={28} />
        GymDesk
      </header>
      <main className="status__body">
        <div className="status__card">
          <Illustration kind={art} />
          <h1>{title}</h1>
          <p>{text}</p>
          <AccountChip />
          <div className="status__actions">
            {actions}
            {!hideHome && (
              <Button variant={actions ? "secondary" : "primary"} icon={<FiHome />} onClick={() => navigate("/")}>
                Go home
              </Button>
            )}
            {user && (
              <Button icon={<FiLogOut />} onClick={() => void signOut().then(() => navigate("/"))}>
                Use another account
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
