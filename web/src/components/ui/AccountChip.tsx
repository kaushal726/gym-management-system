/* "Signed in as …" with a switch-account button, so people always know which Gmail they are using. */
import { FiLogOut } from "react-icons/fi";
import { navigate } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { Avatar } from "./Feedback.tsx";
import { IconButton } from "./Button.tsx";

/** `afterSignOut` is where switching account lands; a claim link passes itself so the right Gmail can open it. */
export function AccountChip({ afterSignOut = "/" }: { afterSignOut?: string }) {
  const { session, signOut } = useSession();
  const user = session?.user;
  if (!user) return null;
  return (
    <div className="status__account">
      <Avatar name={user.name} src={user.pictureUrl} size={36} />
      <span style={{ flex: 1 }}>
        <small>Signed in as</small>
        <strong>{user.email}</strong>
      </span>
      <IconButton label="Use another account" icon={<FiLogOut />} onClick={() => void signOut().then(() => navigate(afterSignOut))} />
    </div>
  );
}
