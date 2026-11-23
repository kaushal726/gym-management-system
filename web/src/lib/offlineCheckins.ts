/* Desk check-ins made while the internet is down wait in this browser and are sent when it is back. */
import { api } from "./api.ts";

const KEY = "gymdesk.offlineCheckins";

interface PendingCheckin {
  gymId: string;
  memberId: string;
  at: string;
}

function read(): PendingCheckin[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as PendingCheckin[];
  } catch {
    return [];
  }
}

function write(items: PendingCheckin[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* Storage blocked: the check-in is simply not queued. */
  }
}

export function queueCheckin(gymId: string, memberId: string): void {
  write([...read(), { gymId, memberId, at: new Date().toISOString() }]);
}

export function pendingCheckins(gymId: string): number {
  return read().filter((c) => c.gymId === gymId).length;
}

/** Sends everything queued; keeps what still fails. Returns how many were sent. */
export async function syncCheckins(): Promise<number> {
  const items = read();
  const left: PendingCheckin[] = [];
  let sent = 0;
  for (const item of items) {
    try {
      await api.post(`/gyms/${item.gymId}/members/${item.memberId}/checkin`, { at: item.at });
      sent += 1;
    } catch (err) {
      if ((err as { status?: number }).status === 0) left.push(item);
    }
  }
  write(left);
  return sent;
}
