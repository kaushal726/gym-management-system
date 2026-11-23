/* Display formatting for dates and times, always in Indian English. */
import type { IsoDate } from "../../../shared/dates.ts";

function parse(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(date: IsoDate | null | undefined): string {
  if (!date) return "—";
  return parse(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDayMonth(date: IsoDate | null | undefined): string {
  if (!date) return "—";
  return parse(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function planLength(months: number | null, days: number | null): string {
  if (months != null) return months === 12 ? "1 year" : plural(months, "month");
  if (days != null) return plural(days, "day");
  return "";
}

/** Today's date on this device, as 'YYYY-MM-DD'. */
export function localToday(): IsoDate {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The first day of this month on this device. */
export function localMonthStart(): IsoDate {
  return `${localToday().slice(0, 8)}01`;
}
