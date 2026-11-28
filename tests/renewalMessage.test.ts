import { describe, expect, it } from "vitest";
import { addDays } from "../shared/dates.ts";
import { ENDING_SOON_DAYS, memberWhatsappText, renewalPitch, whatsappText, type MemberStanding } from "../shared/renewalMessage.ts";
import { REMINDER_TYPES } from "../shared/reminders.ts";

const ctx = { memberName: "  Rahul  Verma ", gymName: "Titan Gym", planName: "Monthly cardio", endDate: "2026-12-28" };

describe("renewalPitch", () => {
  it("for every day from 30 days ahead to 60 days past, is friendly, complete and never shows a raw value", () => {
    for (let daysLeft = 30; daysLeft >= -60; daysLeft--) {
      const text = renewalPitch({ ...ctx, daysLeft });
      expect(text).toContain("Hi Rahul!");
      expect(text).toContain("Titan Gym");
      expect(text).toContain("Monthly cardio");
      expect(text).not.toMatch(/undefined|null|NaN|\[object/);
      expect(text.length).toBeGreaterThan(80);
      expect(text.length).toBeLessThan(900);
      if (daysLeft >= 2) expect(text).toContain(`${daysLeft} din`);
      // The last day says "today", every other message names the date.
      if (daysLeft !== 0) expect(text).toContain("28 Dec");
    }
  });

  it("changes its message at the right moments", () => {
    expect(renewalPitch({ ...ctx, daysLeft: 3 })).toContain("bas 3 din bache");
    expect(renewalPitch({ ...ctx, daysLeft: 1 })).toContain("Kal");
    expect(renewalPitch({ ...ctx, daysLeft: 0 })).toContain("last day");
    expect(renewalPitch({ ...ctx, daysLeft: -2 })).toContain("khatam ho gaya");
    expect(renewalPitch({ ...ctx, daysLeft: -30 })).toContain("kami mehsoos");
  });

  it("copes with no plan name, no date and a one-word or odd name", () => {
    for (const daysLeft of [5, 1, 0, -3, -40]) {
      const text = renewalPitch({ memberName: "Sunita", gymName: "Titan Gym", planName: null, endDate: null, daysLeft });
      expect(text).toContain("Hi Sunita!");
      expect(text).not.toMatch(/undefined|null|NaN/);
    }
    expect(renewalPitch({ ...ctx, memberName: "   ", daysLeft: 3 })).toContain("Hi");
  });
});

describe("whatsappText", () => {
  it("uses the pitch for expiry and renewal reminders and the plain reminder for the rest", () => {
    const withPlan = { ...ctx, duePaise: 50_000 };
    for (const type of REMINDER_TYPES) {
      const text = whatsappText(type, withPlan);
      expect(text).not.toMatch(/undefined|null|NaN/);
      if (["EXPIRY_M5", "EXPIRY_M1", "EXPIRY_0", "EXPIRED_P3", "RENEW_P7", "RENEW_P15"].includes(type)) expect(text).toContain("Team Titan Gym");
      else expect(text).not.toContain("Team Titan Gym");
    }
    expect(whatsappText("EXPIRY_M5", { ...ctx, duePaise: 0 })).toContain("5 din");
    expect(whatsappText("DUES", withPlan)).toContain("₹500");
  });
});

describe("memberWhatsappText", () => {
  const today = "2026-11-28";
  const plan = (days: number) => ({ planName: "Monthly cardio", endDate: addDays(today, days) });
  const standing = (over: Partial<MemberStanding>): MemberStanding => ({ state: "ACTIVE", daysLeft: 20, daysSinceEnd: null, current: plan(20), upcoming: null, ...over });
  const who = { memberName: "Rahul Verma", gymName: "Titan Gym" };

  it("only greets a member whose plan is far from ending, has a renewal waiting, or has no plan", () => {
    expect(memberWhatsappText(standing({}), who)).toBe("Hi Rahul,");
    expect(memberWhatsappText(standing({ daysLeft: ENDING_SOON_DAYS + 1 }), who)).toBe("Hi Rahul,");
    expect(memberWhatsappText(standing({ daysLeft: 2, upcoming: { id: "next" } }), who)).toBe("Hi Rahul,");
    expect(memberWhatsappText(standing({ state: "NO_PLAN", daysLeft: null, current: null }), who)).toBe("Hi Rahul,");
    expect(memberWhatsappText(standing({ state: "UPCOMING", daysLeft: null }), who)).toBe("Hi Rahul,");
  });

  it("pitches a renewal when the plan ends within a week, or has ended", () => {
    for (let daysLeft = 0; daysLeft <= ENDING_SOON_DAYS; daysLeft++) {
      expect(memberWhatsappText(standing({ daysLeft, current: plan(daysLeft) }), who)).toContain("Team Titan Gym");
    }
    expect(memberWhatsappText(standing({ state: "FROZEN", daysLeft: 3 }), who)).toContain("3 din");
    expect(memberWhatsappText(standing({ state: "GRACE", daysLeft: null, daysSinceEnd: 2, current: plan(-2) }), who)).toContain("khatam ho gaya");
    expect(memberWhatsappText(standing({ state: "EXPIRED", daysLeft: null, daysSinceEnd: 90, current: plan(-90) }), who)).toContain("kami mehsoos");
  });
});
