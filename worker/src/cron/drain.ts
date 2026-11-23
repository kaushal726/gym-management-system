/* Sends queued pushes within the free plan's limit of outgoing requests per run. Whatever does not fit
 * waits for the next hourly run. A push that reaches no device marks its follow-up "call instead". */
import type { Env } from "../env.ts";
import { nowIso } from "../lib/ids.ts";
import { pushTargets } from "../push/notify.ts";
import { sendPush } from "../push/webpush.ts";
import { vapidKeys } from "../push/notify.ts";

/** The free plan allows 50 outgoing requests per invocation; keep a margin for Google keys and retries. */
const PUSH_BUDGET = 40;
/** Pushes older than this are dropped: a reminder delivered two days late helps nobody. */
const QUEUE_MAX_AGE_MS = 36 * 3_600_000;

interface QueueRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  url: string;
  tag: string | null;
  followup_id: string | null;
  created_at: string;
}

export interface DrainResult {
  sent: number;
  failed: number;
  noDevice: number;
  remaining: number;
}

export async function drainPushQueue(env: Env): Promise<DrainResult> {
  const db = env.DB;
  const result: DrainResult = { sent: 0, failed: 0, noDevice: 0, remaining: 0 };
  await db.prepare("UPDATE push_queue SET status = 'EXPIRED' WHERE status = 'PENDING' AND created_at < ?1").bind(new Date(Date.now() - QUEUE_MAX_AGE_MS).toISOString()).run();
  const vapid = vapidKeys(env);
  if (!vapid) return result;

  const { results: queue } = await db.prepare("SELECT * FROM push_queue WHERE status = 'PENDING' ORDER BY created_at LIMIT 200").all<QueueRow>();
  if (queue.length === 0) return result;
  const targets = await pushTargets(db, [...new Set(queue.map((q) => q.user_id))]);
  const byUser = new Map<string, typeof targets>();
  for (const t of targets) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t]);

  let budget = PUSH_BUDGET;
  const updates: D1PreparedStatement[] = [];
  const gone: string[] = [];
  for (const item of queue) {
    const devices = byUser.get(item.user_id) ?? [];
    if (devices.length > budget) {
      result.remaining += 1;
      continue;
    }
    let status: "SENT" | "FAILED" | "NO_DEVICE" = devices.length ? "FAILED" : "NO_DEVICE";
    for (const device of devices) {
      budget -= 1;
      const outcome = await sendPush(device, { title: item.title, body: item.body, url: item.url, tag: item.tag ?? undefined }, vapid);
      if (outcome === "sent") status = "SENT";
      if (outcome === "gone") gone.push(device.endpoint);
    }
    if (status === "SENT") result.sent += 1;
    else if (status === "FAILED") result.failed += 1;
    else result.noDevice += 1;
    updates.push(db.prepare("UPDATE push_queue SET status = ?1, sent_at = ?2 WHERE id = ?3").bind(status, nowIso(), item.id));
    if (status !== "SENT" && item.followup_id) updates.push(db.prepare("UPDATE followups SET push_failed = 1 WHERE id = ?1").bind(item.followup_id));
  }
  for (const endpoint of gone) updates.push(db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?1").bind(endpoint));
  if (updates.length) await db.batch(updates);
  return result;
}
