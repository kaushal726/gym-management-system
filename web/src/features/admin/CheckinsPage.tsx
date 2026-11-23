/* Check-ins: today's visits as they happen (refreshes on its own), and a quick desk check-in by name or number. */
import { useEffect, useState } from "react";
import { PiArrowsClockwiseBold, PiCheckSquareDuotone, PiMagnifyingGlassBold, PiWifiSlashBold } from "react-icons/pi";
import type { CheckinFeedItem, MemberListItem } from "../../../../shared/api.ts";
import { formatMobile } from "../../../../shared/phone.ts";
import { api, errorMessage } from "../../lib/api.ts";
import { formatTime } from "../../lib/format.ts";
import { pendingCheckins, queueCheckin } from "../../lib/offlineCheckins.ts";
import { Link } from "../../lib/router.tsx";
import { STATE_LABEL } from "../../lib/states.ts";
import { useApi } from "../../lib/useApi.ts";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { Avatar, EmptyState, ErrorState, ListSkeleton, Notice, StateBadge } from "../../components/ui/Feedback.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { useAdmin } from "./AdminShell.tsx";

const FEED_REFRESH_MS = 20_000;

export function CheckinsPage() {
  const { gymId, base, gym } = useAdmin();
  const toast = useToast();
  const feed = useApi<{ day: string; items: CheckinFeedItem[] }>(`/gyms/${gymId}/checkins`);
  const [query, setQuery] = useState("");
  const search = useApi<{ items: MemberListItem[] }>(query.trim().length >= 2 ? `/gyms/${gymId}/members?filter=all&q=${encodeURIComponent(query.trim())}` : null);
  const [queued, setQueued] = useState(() => pendingCheckins(gymId));

  useEffect(() => {
    const t = window.setInterval(feed.reload, FEED_REFRESH_MS);
    return () => window.clearInterval(t);
  }, [feed.reload]);

  const checkIn = async (m: MemberListItem) => {
    if (!navigator.onLine) {
      queueCheckin(gymId, m.id);
      setQueued(pendingCheckins(gymId));
      toast(`${m.name.split(" ")[0]} saved offline`);
      setQuery("");
      return;
    }
    try {
      const r = await api.post<{ result: keyof typeof STATE_LABEL; alreadyToday: boolean }>(`/gyms/${gymId}/members/${m.id}/checkin`, {});
      toast(r.alreadyToday ? `${m.name} already checked in today` : `${m.name} · ${STATE_LABEL[r.result]}`, r.result === "ACTIVE" || r.result === "GRACE" ? "success" : "error");
      setQuery("");
      feed.reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  if (!gym.checkinEnabled) {
    return (
      <div className="page">
        <EmptyState icon={<PiCheckSquareDuotone />} title="Check-in is off" text="Turn it on in Settings to let members check in from the QR code." />
      </div>
    );
  }

  const joined = (search.data?.items ?? []).filter((m) => m.status === "JOINED").slice(0, 6);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Check-ins</h1>
          <p>{feed.data ? `${feed.data.items.length} today` : " "}</p>
        </div>
        <IconButton label="Refresh" icon={<PiArrowsClockwiseBold />} onClick={feed.reload} />
      </div>

      {queued > 0 && (
        <Notice tone="warning">
          <PiWifiSlashBold aria-hidden style={{ verticalAlign: "-2px" }} /> {queued} check-in{queued === 1 ? "" : "s"} saved offline. They sync when the internet is back.
        </Notice>
      )}

      <div className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3>Check someone in at the desk</h3>
        <div className="input-affix">
          <PiMagnifyingGlassBold className="input-affix__prefix" aria-hidden />
          <input className="input" type="search" placeholder="Name or mobile" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find member to check in" />
        </div>
        {joined.length > 0 && (
          <div className="list" style={{ margin: "0 -16px" }}>
            {joined.map((m) => (
              <div className="list-row" key={m.id}>
                <Avatar name={m.name} src={m.pictureUrl} />
                <span className="list-row__main">
                  <span className="list-row__title">{m.name}</span>
                  <span className="list-row__sub">{formatMobile(m.phone)}</span>
                </span>
                <StateBadge state={m.state} />
                <Button size="sm" variant="primary" onClick={() => void checkIn(m)}>
                  Check in
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        {feed.error && !feed.data ? (
          <ErrorState message={feed.error.message} onRetry={feed.reload} />
        ) : feed.loading && !feed.data ? (
          <ListSkeleton rows={5} />
        ) : feed.data && feed.data.items.length === 0 ? (
          <EmptyState icon={<PiCheckSquareDuotone />} title="No check-ins yet today" text="Members scan the QR code at the entrance. Red means their plan has ended." />
        ) : (
          <div className="list">
            {feed.data?.items.map((c) => (
              <Link key={c.id} href={`${base}/members/${c.member.id}`} className="list-row">
                <Avatar name={c.member.name} src={c.member.pictureUrl} />
                <span className="list-row__main">
                  <span className="list-row__title">{c.member.name}</span>
                  <span className="list-row__sub">
                    {formatTime(c.at)} · {c.method === "QR" ? "QR" : c.method === "DESK" ? "Desk" : "Offline"}
                  </span>
                </span>
                <StateBadge state={c.result} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
