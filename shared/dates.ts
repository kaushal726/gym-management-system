/* Calendar maths for memberships. A date is a plain 'YYYY-MM-DD' string in the gym's own time zone,
 * never a timestamp, so "today" and "ends on" mean the same thing to the desk, the member and the cron. */
import { addDays as fnsAddDays, addMonths as fnsAddMonths, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toIso(date: Date): IsoDate {
  return format(date, "yyyy-MM-dd");
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && toIso(parsed) === value;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIso(fnsAddDays(parseISO(date), days));
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

export interface PlanLength {
  durationMonths: number | null;
  durationDays: number | null;
}

/**
 * The last day (inclusive) of a plan that starts on `start`.
 * Months: the day before the same date n months later, except when that date does not exist
 * (31 Jan + 1 month), where the plan ends on the last day of the target month (28/29 Feb).
 * So 1 Mar ends 31 Mar, 31 Mar ends 30 Apr, 31 Jan ends 28 Feb, and the next plan always starts the day after.
 * Days: n days including the start day.
 */
export function planEndDate(start: IsoDate, length: PlanLength): IsoDate {
  if (length.durationMonths != null) {
    const startDate = parseISO(start);
    const target = fnsAddMonths(startDate, length.durationMonths);
    const clamped = target.getDate() !== startDate.getDate();
    return clamped ? toIso(target) : toIso(fnsAddDays(target, -1));
  }
  if (length.durationDays != null) return addDays(start, length.durationDays - 1);
  throw new Error("Plan has no length");
}

function partsIn(timeZone: string, now: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Today's date in a time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  const p = partsIn(timeZone, now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** The hour of the day (0-23) in a time zone. */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  return Number(partsIn(timeZone, now).hour);
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Age in whole years on a given day. */
export function ageOn(dob: IsoDate, on: IsoDate): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  const hadBirthday = m > bm || (m === bm && d >= bd);
  return y - by - (hadBirthday ? 0 : 1);
}
