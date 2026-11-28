/* Audit log (owner): every change to members, plans, money and settings, who made it and why. */
import { useEffect, useState } from "react";
import { PiShieldCheckDuotone } from "react-icons/pi";
import type { AuditEntry } from "../../../../shared/api.ts";
import { api, errorMessage } from "../../lib/api.ts";
import { formatDateTime } from "../../lib/format.ts";
import { useApi } from "../../lib/useApi.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Badge, EmptyState, ErrorState, ListSkeleton } from "../../components/ui/Feedback.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { describeChanges } from "./auditFormat.ts";
import { useAdmin } from "./AdminShell.tsx";

const ACTION_LABEL: Record<string, string> = {
  GYM_CREATE: "Gym created",
  MEMBER_REGISTER: "Signed up from QR",
  MEMBER_ADD: "Member added",
  MEMBER_EDIT: "Details edited",
  MEMBER_SELF_EDIT: "Member edited own details",
  MEMBER_PHONE_EDIT: "Phone number changed",
  MEMBER_REJECT: "Request rejected",
  MEMBER_ARCHIVE: "Member archived",
  MEMBER_UNARCHIVE: "Member restored",
  MEMBER_ANONYMISE: "Personal data deleted",
  MEMBER_LINK_SENT: "App link sent",
  MEMBER_LINK: "Google account linked",
  MEMBER_UNLINK: "App unlinked",
  MEMBER_MERGE: "Duplicate sign-up merged",
  SUB_CREATE: "Plan started",
  SUB_RENEW: "Plan renewed",
  SUB_CANCEL: "Plan cancelled",
  SUB_EDIT: "Member's plan edited",
  SUB_FREEZE: "Plan frozen",
  PAYMENT_ADD: "Payment recorded",
  PAYMENT_VOID: "Payment voided",
  PAYMENT_REFUND: "Refund given",
  PLAN_CREATE: "Plan type created",
  PLAN_EDIT: "Plan type edited",
  SETTINGS_EDIT: "Settings changed",
  STAFF_INVITE: "Staff invited",
  STAFF_EDIT: "Staff access changed",
  STAFF_REMOVE: "Staff removed",
};

const SENSITIVE = new Set(["PAYMENT_VOID", "PAYMENT_REFUND", "SUB_CANCEL", "SUB_EDIT", "MEMBER_UNLINK", "MEMBER_ANONYMISE", "STAFF_REMOVE", "MEMBER_PHONE_EDIT"]);

export function AuditPage() {
  const { gymId } = useAdmin();
  const toast = useToast();
  const first = useApi<{ items: AuditEntry[]; nextBefore: string | null }>(`/gyms/${gymId}/audit`);
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (first.data) {
      setItems(first.data.items);
      setNext(first.data.nextBefore);
    }
  }, [first.data]);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    try {
      const page = await api.get<{ items: AuditEntry[]; nextBefore: string | null }>(`/gyms/${gymId}/audit?before=${encodeURIComponent(next)}`);
      setItems((list) => [...list, ...page.items]);
      setNext(page.nextBefore);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setMore(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p>Nothing is ever deleted. Every change is listed here with who made it.</p>
        </div>
      </div>
      <div className="card">
        {first.error && !first.data ? (
          <ErrorState message={first.error.message} onRetry={first.reload} />
        ) : first.loading && !first.data ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState icon={<PiShieldCheckDuotone />} title="No changes yet" />
        ) : (
          <div className="list">
            {items.map((a) => {
              const diffs = describeChanges(a.before, a.after);
              return (
                <div className="list-row" key={a.id} style={{ alignItems: "flex-start" }}>
                  <span className="list-row__main">
                    <span className="list-row__title" style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "normal" }}>
                      {ACTION_LABEL[a.action] ?? a.action}
                      {SENSITIVE.has(a.action) && <Badge tone="danger">Check</Badge>}
                    </span>
                    <span className="list-row__sub" style={{ whiteSpace: "normal" }}>
                      {a.actorName ?? "System"} · {formatDateTime(a.at)}
                    </span>
                    {a.reason && (
                      <span className="list-row__sub" style={{ whiteSpace: "normal", color: "var(--text-2)" }}>
                        Reason: {a.reason}
                      </span>
                    )}
                    {diffs.slice(0, 4).map((d) => (
                      <span key={d} className="list-row__sub tabular" style={{ whiteSpace: "normal", fontSize: 12 }}>
                        {d}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {next && (
          <div className="card__body" style={{ borderTop: "1px solid var(--border)" }}>
            <Button block loading={more} onClick={() => void loadMore()}>
              Load older
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
