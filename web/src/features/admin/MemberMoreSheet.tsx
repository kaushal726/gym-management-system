/* Less common actions on a member: send the app link on WhatsApp, check in by hand, freeze, reject, archive, delete data. */
import { useState } from "react";
import type { ReactNode } from "react";
import { PiArchiveBold, PiArrowCounterClockwiseBold, PiCheckSquareBold, PiCopyBold, PiLinkBold, PiLinkBreakBold, PiTrashBold, PiUserMinusBold, PiWhatsappLogoBold } from "react-icons/pi";
import type { ClaimLink, MemberDetail } from "../../../../shared/api.ts";
import { whatsappLink } from "../../../../shared/phone.ts";
import { api, errorMessage } from "../../lib/api.ts";
import { queueCheckin } from "../../lib/offlineCheckins.ts";
import { STATE_LABEL } from "../../lib/states.ts";
import { Button, ButtonLink } from "../../components/ui/Button.tsx";
import { Notice } from "../../components/ui/Feedback.tsx";
import { ReasonSheet } from "../../components/ui/ReasonSheet.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { useAdmin } from "./AdminShell.tsx";

type Confirm = "reject" | "archive" | "anonymise" | "unlink" | null;

export function MemberMoreSheet({ open, detail, onClose, onDone }: { open: boolean; detail: MemberDetail; onClose: () => void; onDone: (message: string) => void }) {
  const { gymId, gym, isOwner } = useAdmin();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<ClaimLink | null>(null);
  const { member } = detail;
  const base = `/gyms/${gymId}/members/${member.id}`;
  const archived = member.archivedAt != null;
  const pending = member.status === "PENDING" || member.status === "LEAD";

  const run = async (fn: () => Promise<string>) => {
    setError(null);
    try {
      onDone(await fn());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // The WhatsApp button appears after the link is made, so the tap that opens WhatsApp is the person's own (no popup blocking).
  const sendLink = async () => {
    setError(null);
    try {
      setLink(await api.post<ClaimLink>(`${base}/claim-link`));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const checkIn = () =>
    run(async () => {
      if (!navigator.onLine) {
        queueCheckin(gymId, member.id);
        return "Offline: check-in saved, it will sync";
      }
      const r = await api.post<{ result: keyof typeof STATE_LABEL; alreadyToday: boolean }>(`${base}/checkin`, {});
      return r.alreadyToday ? "Already checked in today" : `Checked in · ${STATE_LABEL[r.result]}`;
    });

  const actions = [
    !archived && member.status === "JOINED" && !member.linkedEmail && { icon: <PiLinkBold />, title: "Send app link on WhatsApp", sub: "They open it, sign in with Google, and see their plan", onClick: sendLink },
    !archived && member.status === "JOINED" && gym.checkinEnabled && { icon: <PiCheckSquareBold />, title: "Check in now", sub: "Works offline too; syncs later", onClick: checkIn },
    pending && { icon: <PiUserMinusBold />, title: "Reject request", sub: "Spam or duplicate sign-up", onClick: () => setConfirm("reject") },
    !archived && !pending && { icon: <PiArchiveBold />, title: "Archive", sub: "Left the gym. Stops all reminders", onClick: () => setConfirm("archive") },
    archived && {
      icon: <PiArrowCounterClockwiseBold />,
      title: "Restore",
      sub: "Bring back to the active list",
      onClick: () =>
        run(async () => {
          await api.post(`${base}/unarchive`);
          return "Member restored";
        }),
    },
    isOwner && (member.linkedEmail || member.inviteEmail) && { icon: <PiLinkBreakBold />, title: "Unlink app", sub: "Wrong Gmail linked? Remove it, then send a new link", onClick: () => setConfirm("unlink") },
    isOwner && { icon: <PiTrashBold />, title: "Delete personal data", sub: "On request. Payments stay for your accounts", onClick: () => setConfirm("anonymise"), danger: true },
  ].filter(Boolean) as { icon: ReactNode; title: string; sub: string; onClick: () => void; danger?: boolean }[];

  return (
    <>
      <Sheet
        open={open && confirm == null}
        title={member.name}
        onClose={() => {
          setLink(null);
          onClose();
        }}
      >
        {link && (
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <Notice tone="success">Link ready. It works once and expires in 7 days.</Notice>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <ButtonLink href={whatsappLink(member.phone, link.whatsappText)} external variant="primary" icon={<PiWhatsappLogoBold />}>
                Open WhatsApp
              </ButtonLink>
              <Button icon={<PiCopyBold />} onClick={() => void navigator.clipboard?.writeText(link.url).then(() => onDone("Link copied"))}>
                Copy link
              </Button>
            </div>
          </div>
        )}
        <div className="list" style={{ margin: "0 -20px" }}>
          {actions.map((a) => (
            <button key={a.title} type="button" className="list-row" onClick={a.onClick} style={{ color: a.danger ? "var(--danger)" : undefined }}>
              {a.icon}
              <span className="list-row__main">
                <span className="list-row__title">{a.title}</span>
                <span className="list-row__sub" style={{ whiteSpace: "normal" }}>
                  {a.sub}
                </span>
              </span>
            </button>
          ))}
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </Sheet>
      <ReasonSheet
        open={open && confirm === "reject"}
        title="Reject this request?"
        confirmLabel="Reject"
        danger
        placeholder="Duplicate, spam, not interested…"
        onClose={() => setConfirm(null)}
        onConfirm={async (reason) => {
          await api.post(`${base}/reject`, { reason });
          setConfirm(null);
          onDone("Request rejected");
        }}
      />
      <ReasonSheet
        open={open && confirm === "archive"}
        title="Archive this member?"
        description="They move out of the lists and get no reminders. You can restore them later."
        confirmLabel="Archive"
        placeholder="Moved city, stopped coming…"
        onClose={() => setConfirm(null)}
        onConfirm={async (reason) => {
          await api.post(`${base}/archive`, { reason });
          setConfirm(null);
          onDone("Member archived");
        }}
      />
      <ReasonSheet
        open={open && confirm === "unlink"}
        title="Unlink the app?"
        description={`${member.linkedEmail ?? member.inviteEmail} will no longer open this membership. Send a new app link to the right Gmail after this.`}
        confirmLabel="Unlink"
        danger
        placeholder="Wrong Gmail linked…"
        onClose={() => setConfirm(null)}
        onConfirm={async (reason) => {
          await api.post(`${base}/unlink`, { reason });
          setConfirm(null);
          onDone("App unlinked");
        }}
      />
      <ReasonSheet
        open={open && confirm === "anonymise"}
        title="Delete personal data?"
        description="Name, number and other details are wiped for good. Payment entries stay, without the name. This cannot be undone."
        confirmLabel="Delete data"
        danger
        placeholder="Member asked for deletion on…"
        onClose={() => setConfirm(null)}
        onConfirm={async (reason) => {
          await api.post(`${base}/anonymise`, { reason });
          setConfirm(null);
          onDone("Personal data deleted");
        }}
      />
    </>
  );
}
