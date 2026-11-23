/* Follow-ups: every reminder the cron made, as a call list. One tap opens WhatsApp with the message written. */
import { useState } from "react";
import { PiCheckBold, PiPhoneBold, PiPhoneCallDuotone, PiWhatsappLogoBold } from "react-icons/pi";
import type { Followup } from "../../../../shared/api.ts";
import { callLink, formatMobile, whatsappLink } from "../../../../shared/phone.ts";
import { api, errorMessage } from "../../lib/api.ts";
import { formatDateTime, formatDayMonth } from "../../lib/format.ts";
import { Link } from "../../lib/router.tsx";
import { useApi } from "../../lib/useApi.ts";
import { Button, ButtonLink } from "../../components/ui/Button.tsx";
import { Badge, EmptyState, ErrorState, ListSkeleton } from "../../components/ui/Feedback.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { Tabs } from "../../components/ui/Tabs.tsx";
import { useAdmin } from "./AdminShell.tsx";

type View = "open" | "done";

const TYPE_TONE: Record<Followup["type"], "warning" | "danger" | "accent" | "neutral"> = {
  EXPIRY_M5: "accent",
  EXPIRY_M1: "warning",
  EXPIRY_0: "warning",
  EXPIRED_P3: "danger",
  RENEW_P7: "danger",
  RENEW_P15: "danger",
  DUES: "warning",
  NO_SHOW: "neutral",
  LEAD: "neutral",
};

export function FollowupsPage() {
  const { gymId, base } = useAdmin();
  const toast = useToast();
  const [view, setView] = useState<View>("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi<{ items: Followup[] }>(`/gyms/${gymId}/followups?view=${view}`);

  const markDone = async (f: Followup) => {
    setBusyId(f.id);
    try {
      await api.post(`/gyms/${gymId}/followups/${f.id}/contacted`, { note: null });
      toast(`${f.member.name.split(" ")[0]} marked as contacted`);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Follow-ups</h1>
          <p>Renewals, dues and leads to call or WhatsApp. New ones come in every morning.</p>
        </div>
      </div>
      <div className="card">
        <div className="card__bar">
          <Tabs
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: "open", label: "To do" },
              { value: "done", label: "Done" },
            ]}
          />
        </div>
        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton rows={5} />
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={<PiPhoneCallDuotone />} art={view === "open" ? "happy" : undefined} title={view === "open" ? "All caught up" : "Nothing here yet"} text={view === "open" ? "Reminders for expiring plans, dues and leads appear here each morning." : undefined} />
        ) : (
          <div className="list">
            {data?.items.map((f) => (
              <div key={f.id} className="list-row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                <div className="list-row__main" style={{ minWidth: 200 }}>
                  <Link href={`${base}/members/${f.member.id}`} className="list-row__title" style={{ color: "inherit" }}>
                    {f.member.name}
                  </Link>
                  <span className="list-row__sub">
                    {formatMobile(f.member.phone)} · {formatDayMonth(f.forDate)}
                  </span>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Badge tone={TYPE_TONE[f.type]}>{f.label}</Badge>
                    {f.pushFailed && view === "open" && <Badge tone="danger">No app notification · call</Badge>}
                  </div>
                  {f.contactedAt && (
                    <span className="list-row__sub" style={{ marginTop: 6, whiteSpace: "normal" }}>
                      Contacted {formatDateTime(f.contactedAt)}
                      {f.contactedByName ? ` by ${f.contactedByName}` : ""}
                      {f.note ? ` · ${f.note}` : ""}
                    </span>
                  )}
                </div>
                {view === "open" && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <ButtonLink href={whatsappLink(f.member.phone, f.message)} external size="sm" icon={<PiWhatsappLogoBold />}>
                      WhatsApp
                    </ButtonLink>
                    <ButtonLink href={callLink(f.member.phone)} external size="sm" icon={<PiPhoneBold />}>
                      Call
                    </ButtonLink>
                    <Button size="sm" variant="ghost" icon={<PiCheckBold />} loading={busyId === f.id} onClick={() => void markDone(f)} aria-label={`Mark ${f.member.name} as contacted`}>
                      Done
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
