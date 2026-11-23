import { describe, expect, it } from "vitest";
import { addDays, ageOn, daysBetween, isIsoDate, planEndDate, todayIn } from "../shared/dates.ts";
import { canVoid, dueOf, maxRefund, netPaid, rupeesToPaise, unusedValue, type PaymentLike } from "../shared/money.ts";
import { nextStartDate, overlapsLive, summarize, type SubDates } from "../shared/membership.ts";
import { remindersFor } from "../shared/reminders.ts";
import { normalizeIndianMobile } from "../shared/phone.ts";
import { gymAccess, gymIsOpen, saasReminderDue } from "../shared/saas.ts";
import { planEdit } from "../shared/subscriptionEdit.ts";

/** Small seeded generator so failures are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function everyDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const DAYS_2024_2028 = everyDay("2024-01-01", "2028-12-31");

describe("planEndDate", () => {
  it("handles the month-end cases the desk asks about", () => {
    const m = (start: string, n: number) => planEndDate(start, { durationMonths: n, durationDays: null });
    expect(m("2026-03-01", 1)).toBe("2026-03-31");
    expect(m("2026-03-31", 1)).toBe("2026-04-30");
    expect(m("2026-01-31", 1)).toBe("2026-02-28");
    expect(m("2028-01-31", 1)).toBe("2028-02-29");
    expect(m("2026-01-15", 1)).toBe("2026-02-14");
    expect(m("2026-01-01", 12)).toBe("2026-12-31");
    expect(m("2026-08-31", 6)).toBe("2027-02-28");
    expect(planEndDate("2026-11-23", { durationMonths: null, durationDays: 1 })).toBe("2026-11-23");
    expect(planEndDate("2026-11-23", { durationMonths: null, durationDays: 30 })).toBe("2026-12-22");
  });

  it("for every start day 2024-2028 and every plan length, ends within sane bounds", () => {
    for (const start of DAYS_2024_2028) {
      for (const months of [1, 2, 3, 6, 12]) {
        const end = planEndDate(start, { durationMonths: months, durationDays: null });
        const length = daysBetween(start, end) + 1;
        expect(isIsoDate(end)).toBe(true);
        expect(length).toBeGreaterThanOrEqual(months * 28 - 1);
        expect(length).toBeLessThanOrEqual(months * 31 + 1);
      }
      const end = planEndDate(start, { durationMonths: 1, durationDays: null });
      expect(daysBetween(start, end) + 1).toBeGreaterThanOrEqual(28);
      expect(daysBetween(start, end) + 1).toBeLessThanOrEqual(31);
    }
  });

  it("back-to-back renewals never overlap and never leave a gap", () => {
    const random = rng(7);
    for (let run = 0; run < 400; run++) {
      let start = DAYS_2024_2028[Math.floor(random() * 1200)];
      const subs: SubDates[] = [];
      for (let i = 0; i < 8; i++) {
        const months = [1, 3, 6, 12][Math.floor(random() * 4)];
        const end = planEndDate(start, { durationMonths: months, durationDays: null });
        expect(overlapsLive(subs, start, end)).toBe(false);
        subs.push({ id: String(i), startDate: start, endDate: end, cancelled: false, frozenToday: false });
        const next = nextStartDate(subs, start);
        expect(next).toBe(addDays(end, 1));
        start = next;
      }
    }
  });
});

describe("dates", () => {
  it("knows today in India even when UTC is still yesterday", () => {
    expect(todayIn("Asia/Kolkata", new Date("2026-11-22T19:00:00Z"))).toBe("2026-11-23");
    expect(todayIn("Asia/Kolkata", new Date("2026-11-22T18:00:00Z"))).toBe("2026-11-22");
  });
  it("rejects impossible dates", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
  });
  it("works out age on a birthday", () => {
    expect(ageOn("2008-11-23", "2026-11-23")).toBe(18);
    expect(ageOn("2008-11-24", "2026-11-23")).toBe(17);
  });
});

describe("money", () => {
  it("reads typed rupees", () => {
    expect(rupeesToPaise("1500")).toBe(150000);
    expect(rupeesToPaise("₹1,500.5")).toBe(150050);
    expect(rupeesToPaise("0.05")).toBe(5);
    expect(rupeesToPaise("-10")).toBeNull();
    expect(rupeesToPaise("1.234")).toBeNull();
    expect(rupeesToPaise("abc")).toBeNull();
    expect(rupeesToPaise("100000000")).toBeNull();
  });

  it("for any mix of payments, voids and refunds the desk allows, dues stay within 0..total and equal total minus net", () => {
    const random = rng(42);
    for (let run = 0; run < 3000; run++) {
      const finalPricePaise = Math.floor(random() * 2_000_000);
      const joiningFeePaise = random() < 0.3 ? Math.floor(random() * 100_000) : 0;
      const charge = { finalPricePaise, joiningFeePaise, cancelled: false };
      const total = finalPricePaise + joiningFeePaise;
      const payments: PaymentLike[] = [];
      for (let step = 0; step < 12; step++) {
        const action = random();
        const due = dueOf(charge, payments);
        if (action < 0.55 && due > 0) {
          payments.push({ amountPaise: 1 + Math.floor(random() * due), voided: false });
        } else if (action < 0.75 && payments.length) {
          const pick = payments[Math.floor(random() * payments.length)];
          if (canVoid(payments, pick)) pick.voided = true;
        } else if (action < 0.85) {
          const refundable = maxRefund(payments);
          if (refundable > 0) payments.push({ amountPaise: -(1 + Math.floor(random() * refundable)), voided: false });
        }
        const now = dueOf(charge, payments);
        expect(now).toBeGreaterThanOrEqual(0);
        expect(now).toBeLessThanOrEqual(total);
        if (netPaid(payments) <= total) expect(now).toBe(total - netPaid(payments));
        expect(maxRefund(payments)).toBeGreaterThanOrEqual(0);
      }
      expect(dueOf({ ...charge, cancelled: true }, payments)).toBe(0);
    }
  });

  it("never suggests more credit than the price", () => {
    expect(unusedValue(300000, 30, 15)).toBe(150000);
    expect(unusedValue(300000, 30, 40)).toBe(300000);
    expect(unusedValue(300000, 30, 0)).toBe(0);
  });
});

describe("editing a plan a member already took", () => {
  const LENGTHS = [
    { durationMonths: 1, durationDays: null },
    { durationMonths: 3, durationDays: null },
    { durationMonths: 12, durationDays: null },
    { durationMonths: null, durationDays: 15 },
  ];

  it("after any mix of payments, voids and refunds, an accepted new price never leaves negative or wrong dues", () => {
    const random = rng(7);
    for (let run = 0; run < 3000; run++) {
      const finalPricePaise = Math.floor(random() * 2_000_000);
      const joiningFeePaise = random() < 0.3 ? Math.floor(random() * 100_000) : 0;
      const charge = { finalPricePaise, joiningFeePaise, cancelled: false };
      const payments: PaymentLike[] = [];
      for (let step = 0; step < 8; step++) {
        const action = random();
        const due = dueOf(charge, payments);
        if (action < 0.6 && due > 0) payments.push({ amountPaise: 1 + Math.floor(random() * due), voided: false });
        else if (action < 0.8 && payments.length) {
          const pick = payments[Math.floor(random() * payments.length)];
          if (canVoid(payments, pick)) pick.voided = true;
        } else if (maxRefund(payments) > 0) payments.push({ amountPaise: -(1 + Math.floor(random() * maxRefund(payments))), voided: false });
      }
      const paid = netPaid(payments);
      const length = LENGTHS[run % LENGTHS.length];
      const sub = { startDate: "2026-11-01", endDate: planEndDate("2026-11-01", length), ...length, joiningFeePaise, paidPaise: paid, freezeDaysUsed: 0 };
      const newPrice = Math.floor(random() * 2_200_000) - 100_000;
      const result = planEdit(sub, { startDate: sub.startDate, ...length, finalPricePaise: newPrice });
      if ("problem" in result) {
        expect(newPrice < 0 || newPrice + joiningFeePaise < paid).toBe(true);
        continue;
      }
      const edited = { finalPricePaise: newPrice, joiningFeePaise, cancelled: false };
      expect(dueOf(edited, payments)).toBe(newPrice + joiningFeePaise - paid);
      expect(dueOf(edited, payments)).toBeGreaterThanOrEqual(0);
      expect(result.endDate).toBe(sub.endDate);
    }
  });

  it("for every start day 2024-2028, a new start or length moves the end date, and a freeze locks the dates", () => {
    for (const [i, start] of DAYS_2024_2028.entries()) {
      const from = LENGTHS[i % LENGTHS.length];
      const to = LENGTHS[(i + 1) % LENGTHS.length];
      const sub = { startDate: start, endDate: planEndDate(start, from), ...from, joiningFeePaise: 0, paidPaise: 0, freezeDaysUsed: 0 };
      const newStart = addDays(start, (i % 9) - 4);
      const moved = planEdit(sub, { startDate: newStart, ...to, finalPricePaise: 100 });
      expect(moved).toEqual({ endDate: planEndDate(newStart, to) });
      const frozenSub = { ...sub, endDate: addDays(sub.endDate, 5), freezeDaysUsed: 5 };
      expect(planEdit(frozenSub, { startDate: newStart, ...to, finalPricePaise: 100 })).toEqual({ problem: "DATES_LOCKED_BY_FREEZE" });
      expect(planEdit(frozenSub, { startDate: start, ...from, finalPricePaise: 100 })).toEqual({ endDate: frozenSub.endDate });
    }
  });
});

describe("summarize", () => {
  const sub = (id: string, startDate: string, endDate: string, extra: Partial<SubDates> = {}): SubDates => ({
    id,
    startDate,
    endDate,
    cancelled: false,
    frozenToday: false,
    ...extra,
  });

  it("moves through upcoming, active, grace and expired", () => {
    const subs = [sub("a", "2026-11-01", "2026-11-30")];
    expect(summarize(subs, "2026-10-31", 3).state).toBe("UPCOMING");
    expect(summarize(subs, "2026-11-01", 3).state).toBe("ACTIVE");
    expect(summarize(subs, "2026-11-30", 3).daysLeft).toBe(0);
    expect(summarize(subs, "2026-12-03", 3).state).toBe("GRACE");
    expect(summarize(subs, "2026-12-04", 3).state).toBe("EXPIRED");
    expect(summarize([], "2026-12-04", 3).state).toBe("NO_PLAN");
  });

  it("ignores cancelled plans and reports freezes", () => {
    expect(summarize([sub("a", "2026-11-01", "2026-11-30", { cancelled: true })], "2026-11-10", 3).state).toBe("NO_PLAN");
    expect(summarize([sub("a", "2026-11-01", "2026-11-30", { frozenToday: true })], "2026-11-10", 3).state).toBe("FROZEN");
  });

  it("puts reminders on the end of the renewal chain, not the plan that is running", () => {
    const subs = [sub("a", "2026-11-01", "2026-11-30"), sub("b", "2026-12-01", "2026-12-31")];
    const summary = summarize(subs, "2026-11-25", 3);
    expect(summary.chainEnd?.id).toBe("b");
    const input = { summary, dueSubs: [], lastVisit: null, checkinEnabled: false };
    expect(remindersFor(input, "2026-11-25")).toEqual([]);
    expect(remindersFor({ ...input, summary: summarize(subs, "2026-12-26", 3) }, "2026-12-26")).toEqual([{ type: "EXPIRY_M5", subscriptionId: "b" }]);
  });

  it("sends each expiry reminder exactly once across a plan's life", () => {
    const subs = [sub("a", "2026-11-01", "2026-11-30")];
    const seen: string[] = [];
    for (const day of everyDay("2026-10-01", "2027-01-31")) {
      const summary = summarize(subs, day, 3);
      for (const r of remindersFor({ summary, dueSubs: [], lastVisit: null, checkinEnabled: false }, day)) seen.push(`${r.type}@${day}`);
    }
    expect(seen).toEqual(["EXPIRY_M5@2026-11-25", "EXPIRY_M1@2026-11-29", "EXPIRY_0@2026-11-30", "EXPIRED_P3@2026-12-03", "RENEW_P7@2026-12-07", "RENEW_P15@2026-12-15"]);
  });

  it("reminds about dues every third day after the start, and about members who stopped coming", () => {
    const subs = [sub("a", "2026-11-01", "2026-11-30")];
    const summary = summarize(subs, "2026-11-04", 3);
    const due = { summary, dueSubs: [{ id: "a", startDate: "2026-11-01", duePaise: 50000 }], lastVisit: null, checkinEnabled: false };
    expect(remindersFor(due, "2026-11-04")).toEqual([{ type: "DUES", subscriptionId: "a" }]);
    expect(remindersFor(due, "2026-11-01")).toEqual([]);
    const noShow = { summary: summarize(subs, "2026-11-15", 3), dueSubs: [], lastVisit: "2026-11-05", checkinEnabled: true };
    expect(remindersFor(noShow, "2026-11-15")).toEqual([{ type: "NO_SHOW", subscriptionId: "a" }]);
  });
});

describe("phone", () => {
  it("normalises Indian mobiles", () => {
    expect(normalizeIndianMobile("+91 98765-43210")).toBe("9876543210");
    expect(normalizeIndianMobile("09876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("12345")).toBeNull();
    expect(normalizeIndianMobile("5876543210")).toBeNull();
  });
});

describe("gym SaaS access", () => {
  const gym = (validTill: string | null, status: "ACTIVE" | "PAUSED" | "ARCHIVED" = "ACTIVE") => ({ status, validTill });
  it("moves from active to expiring, grace and paused around valid_till", () => {
    expect(gymAccess(gym("2026-12-31"), "2026-12-01")).toBe("ACTIVE");
    expect(gymAccess(gym("2026-12-31"), "2026-12-24")).toBe("EXPIRING");
    expect(gymAccess(gym("2026-12-31"), "2026-12-31")).toBe("EXPIRING");
    expect(gymAccess(gym("2026-12-31"), "2027-01-03")).toBe("GRACE");
    expect(gymAccess(gym("2026-12-31"), "2027-01-04")).toBe("PAUSED");
    expect(gymAccess(gym(null), "2030-01-01")).toBe("ACTIVE");
  });
  it("honours manual pause and archive whatever the date", () => {
    expect(gymAccess(gym("2099-01-01", "PAUSED"), "2026-12-01")).toBe("PAUSED");
    expect(gymAccess(gym(null, "ARCHIVED"), "2026-12-01")).toBe("ARCHIVED");
    expect(gymIsOpen("GRACE")).toBe(true);
    expect(gymIsOpen("PAUSED")).toBe(false);
  });
  it("reminds the owner a week before, the day before, on the day and the day after", () => {
    const days = everyDay("2026-12-01", "2027-01-10").filter((d) => saasReminderDue(gym("2026-12-31"), d));
    expect(days).toEqual(["2026-12-24", "2026-12-30", "2026-12-31", "2027-01-01"]);
    expect(saasReminderDue(gym("2026-12-31", "PAUSED"), "2026-12-24")).toBe(false);
  });
});
