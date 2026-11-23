/* The once-a-day job per gym, at the gym's reminder hour: pending requests become leads, reminders are
 * worked out for every member, each one lands on the follow-up list and in the push queue, and the
 * owners get a morning digest. Safe to run twice: every insert is keyed, so a rerun adds nothing. */
import { PENDING_EXPIRY_DAYS } from "../../../shared/constants.ts";
import { addDays, hourIn, todayIn, type IsoDate } from "../../../shared/dates.ts";
import { matchesFilter } from "../../../shared/filters.ts";
import { formatRupees } from "../../../shared/money.ts";
import { displayDate, reminderMessage, remindersFor, type ReminderType } from "../../../shared/reminders.ts";
import type { Env } from "../env.ts";
import { newId, nowIso } from "../lib/ids.ts";
import { loadRoster, toListItem, type RosterEntry } from "../db/queries.ts";
import type { GymRow } from "../db/rows.ts";
import { ownerUserIds } from "../push/notify.ts";
import { gymAccess, gymIsOpen, saasReminderDue } from "../../../shared/saas.ts";

interface QueuedReminder {
  entry: RosterEntry;
  type: ReminderType;
  subscriptionId: string;
}

function queueStatement(db: D1Database, gymId: string, userId: string, title: string, body: string, url: string, tag: string, followupId: string | null) {
  return db
    .prepare("INSERT INTO push_queue (id, gym_id, user_id, title, body, url, tag, followup_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
    .bind(newId(), gymId, userId, title, body, url, tag, followupId, nowIso());
}

export interface DailyResult {
  gymId: string;
  leads: number;
  reminders: number;
  skipped: boolean;
}

export async function runDailyForGym(env: Env, gym: GymRow, today: IsoDate): Promise<DailyResult> {
  const db = env.DB;
  const done = await db.prepare("SELECT 1 FROM gym_daily_runs WHERE gym_id = ?1 AND for_date = ?2").bind(gym.id, today).first();
  if (done) return { gymId: gym.id, leads: 0, reminders: 0, skipped: true };

  // A paused or archived gym sends nothing: no member reminders, no digest, no leads.
  const saas = { status: gym.status, validTill: gym.valid_till };
  if (!gymIsOpen(gymAccess(saas, today))) {
    await db.prepare("INSERT OR IGNORE INTO gym_daily_runs (gym_id, for_date, ran_at) VALUES (?1, ?2, ?3)").bind(gym.id, today, nowIso()).run();
    return { gymId: gym.id, leads: 0, reminders: 0, skipped: true };
  }

  // 1. Pending requests nobody activated within a week become leads (kept for a follow-up call).
  const cutoff = `${addDays(today, 1 - PENDING_EXPIRY_DAYS)}T00:00:00.000Z`;
  const leads = await db
    .prepare("UPDATE members SET status = 'LEAD' WHERE gym_id = ?1 AND status = 'PENDING' AND created_at < ?2 AND archived_at IS NULL RETURNING id")
    .bind(gym.id, cutoff)
    .all<{ id: string }>();

  // 2. Reminders for every member who is a customer of this gym.
  const roster = await loadRoster(db, gym, today);
  const leadIds = new Set(leads.results.map((l) => l.id));
  const due: QueuedReminder[] = [];
  for (const entry of roster) {
    if (entry.member.archived_at) continue;
    if (leadIds.has(entry.member.id)) {
      due.push({ entry, type: "LEAD", subscriptionId: `lead:${entry.member.id}` });
      continue;
    }
    if (entry.member.status !== "JOINED") continue;
    const reminders = remindersFor(
      {
        summary: entry.standing.membership,
        dueSubs: entry.subs.map((s) => ({ id: s.id, startDate: s.startDate, duePaise: s.duePaise })),
        lastVisit: entry.lastVisit,
        checkinEnabled: gym.checkin_enabled === 1,
      },
      today,
    );
    for (const r of reminders) due.push({ entry, ...r });
  }

  // Claim each reminder; only the ones not already claimed go further.
  const claims = due.length
    ? await db.batch(
        due.map((d) =>
          db.prepare("INSERT OR IGNORE INTO reminders_sent (gym_id, subscription_id, type, for_date, sent_at) VALUES (?1, ?2, ?3, ?4, ?5)").bind(gym.id, d.subscriptionId, d.type, today, nowIso()),
        ),
      )
    : [];
  const fresh = due.filter((_, i) => (claims[i]?.meta.changes ?? 0) > 0);

  const writes: D1PreparedStatement[] = [];
  for (const d of fresh) {
    const followupId = newId();
    const subId = d.subscriptionId.startsWith("lead:") ? null : d.subscriptionId;
    writes.push(
      db.prepare("INSERT OR IGNORE INTO followups (id, gym_id, member_id, subscription_id, type, for_date) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(
        followupId,
        gym.id,
        d.entry.member.id,
        subId,
        d.type,
        today,
      ),
    );
    if (d.entry.member.user_id) {
      const msg = reminderMessage(d.type, {
        memberName: d.entry.member.name,
        gymName: gym.name,
        endDate: d.entry.standing.membership.chainEnd?.endDate ?? null,
        duePaise: d.entry.standing.duePaise,
      });
      writes.push(queueStatement(db, gym.id, d.entry.member.user_id, msg.title, msg.body, "/me", `${d.type}-${d.subscriptionId}`, followupId));
    } else {
      writes.push(db.prepare("UPDATE followups SET push_failed = 1 WHERE id = ?1").bind(followupId));
    }
  }

  // 3. The owners' morning digest.
  const items = roster.map((e) => toListItem(e, today));
  const count = (f: Parameters<typeof matchesFilter>[1]) => items.filter((i) => matchesFilter(i, f)).length;
  const duesTotal = items.filter((i) => !i.archived).reduce((sum, i) => sum + i.duePaise, 0);
  const parts = [`${count("pending")} pending`, `${count("expiring")} expiring this week`, `${count("grace")} in grace`, `${formatRupees(duesTotal)} dues`];
  const owners = await ownerUserIds(db, gym.id);
  for (const ownerId of owners) {
    writes.push(queueStatement(db, gym.id, ownerId, `Good morning, ${gym.name}`, `${parts.join(" · ")}. ${fresh.length} follow-ups today.`, `/admin/${gym.id}`, `digest-${today}`, null));
    if (saasReminderDue(saas, today) && gym.valid_till) {
      writes.push(
        queueStatement(db, gym.id, ownerId, "GymDesk plan renewal", `Your GymDesk plan ends on ${displayDate(gym.valid_till)}. Please renew to keep the desk running without a break.`, `/admin/${gym.id}`, `saas-${today}`, null),
      );
    }
  }

  writes.push(db.prepare("INSERT OR IGNORE INTO gym_daily_runs (gym_id, for_date, ran_at) VALUES (?1, ?2, ?3)").bind(gym.id, today, nowIso()));
  await db.batch(writes);
  return { gymId: gym.id, leads: leads.results.length, reminders: fresh.length, skipped: false };
}

/** Runs the daily job for every gym whose reminder hour it is now (or for all, when a date is forced in development). */
export async function runDueGyms(env: Env, now: Date, forcedDate?: IsoDate): Promise<DailyResult[]> {
  const { results: gyms } = await env.DB.prepare("SELECT * FROM gyms").all<GymRow>();
  const results: DailyResult[] = [];
  for (const gym of gyms) {
    if (gym.status === "ARCHIVED") continue;
    if (!forcedDate && hourIn(gym.timezone, now) < gym.reminder_hour) continue;
    results.push(await runDailyForGym(env, gym, forcedDate ?? todayIn(gym.timezone, now)));
  }
  return results;
}
