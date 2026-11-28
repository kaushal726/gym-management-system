/* Sends a message to every device of a set of users and forgets devices the push service says are gone. */
import type { Env } from "../env.ts";
import { chunk } from "../lib/chunk.ts";
import { sendPush, type PushMessage, type PushTarget, type VapidKeys } from "./webpush.ts";

export function vapidKeys(env: Env): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK) return null;
  return { publicKey: env.VAPID_PUBLIC_KEY, privateJwk: env.VAPID_PRIVATE_JWK, subject: env.VAPID_SUBJECT || "mailto:noreply@example.com" };
}

interface TargetRow extends PushTarget {
  user_id: string;
}

export async function pushTargets(db: D1Database, userIds: readonly string[]): Promise<TargetRow[]> {
  if (userIds.length === 0) return [];
  // One batch of statements, each with at most MAX_BOUND_VALUES users, so any number of users stays under D1's limit.
  const statements = chunk(userIds).map((ids) => {
    const placeholders = ids.map((_, i) => `?${i + 1}`).join(", ");
    return db.prepare(`SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${placeholders})`).bind(...ids);
  });
  const results = await db.batch<TargetRow>(statements);
  return results.flatMap((r) => r.results);
}

/** Returns the users at least one of whose devices accepted the message. */
export async function deliver(env: Env, targets: readonly TargetRow[], messageFor: (userId: string) => PushMessage | null): Promise<Set<string>> {
  const vapid = vapidKeys(env);
  const reached = new Set<string>();
  if (!vapid) return reached;
  const gone: string[] = [];
  await Promise.all(
    targets.map(async (t) => {
      const message = messageFor(t.user_id);
      if (!message) return;
      const outcome = await sendPush(t, message, vapid);
      if (outcome === "sent") reached.add(t.user_id);
      if (outcome === "gone") gone.push(t.endpoint);
    }),
  );
  if (gone.length) {
    await env.DB.batch(gone.map((endpoint) => env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?1").bind(endpoint)));
  }
  return reached;
}

export async function notifyUsers(env: Env, userIds: readonly string[], message: PushMessage): Promise<Set<string>> {
  return deliver(env, await pushTargets(env.DB, userIds), () => message);
}

export async function ownerUserIds(db: D1Database, gymId: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT user_id FROM gym_staff WHERE gym_id = ?1 AND role = 'OWNER' AND active = 1 AND user_id IS NOT NULL")
    .bind(gymId)
    .all<{ user_id: string }>();
  return results.map((r) => r.user_id);
}
