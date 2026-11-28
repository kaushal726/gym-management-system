import { describe, expect, it } from "vitest";
import type { MemberListItem } from "../shared/api.ts";
import { formatAgo } from "../web/src/lib/format.ts";
import { memberCardLines } from "../web/src/features/admin/memberCardLines.ts";

const TODAY = "2026-11-28";

function member(over: Partial<MemberListItem>): MemberListItem {
  return {
    id: "m1",
    name: "Test Member",
    phone: "9876543210",
    pictureUrl: null,
    status: "JOINED",
    source: "DESK",
    requestNo: null,
    archived: false,
    createdAt: "2026-11-20T10:00:00.000Z",
    linked: true,
    state: "ACTIVE",
    planName: "Monthly cardio",
    endDate: "2026-12-17",
    daysLeft: 19,
    daysSinceEnd: null,
    hasUpcoming: false,
    duePaise: 0,
    ptActive: false,
    lastVisit: null,
    batch: "EVENING",
    ...over,
  };
}

describe("member card lines", () => {
  it("shows contact, plan and end date for an active member", () => {
    const lines = memberCardLines(member({}), TODAY);
    expect(lines.contact).toBe("98765 43210 · Evening");
    expect(lines.plan).toBe("Monthly cardio");
    expect(lines.validity).toEqual({ text: "Ends 17 Dec · 19 days left" });
    expect(lines.aside).toBeNull();
  });

  it("warns when a plan has a week or less left, and on its last day", () => {
    expect(memberCardLines(member({ daysLeft: 7, endDate: "2026-12-05" }), TODAY).validity?.tone).toBe("warning");
    expect(memberCardLines(member({ daysLeft: 8, endDate: "2026-12-06" }), TODAY).validity?.tone).toBeUndefined();
    expect(memberCardLines(member({ daysLeft: 0, endDate: TODAY }), TODAY).validity).toEqual({ text: "Ends 28 Nov · last day", tone: "warning" });
    expect(memberCardLines(member({ daysLeft: 1 }), TODAY).validity?.text).toContain("1 day left");
  });

  it("shows how long ago a plan ended: amber in grace, red once expired", () => {
    const grace = memberCardLines(member({ state: "GRACE", daysLeft: null, daysSinceEnd: 2, endDate: "2026-11-26" }), TODAY);
    expect(grace.validity).toEqual({ text: "Ended 26 Nov · 2 days ago", tone: "warning" });
    const expired = memberCardLines(member({ state: "EXPIRED", daysLeft: null, daysSinceEnd: 22, endDate: "2026-11-06" }), TODAY);
    expect(expired.validity).toEqual({ text: "Ended 6 Nov · 22 days ago", tone: "danger" });
  });

  it("puts dues ahead of the last visit", () => {
    expect(memberCardLines(member({ duePaise: 150000, lastVisit: TODAY }), TODAY).aside).toEqual({ text: "₹1,500 due", tone: "warning" });
    expect(memberCardLines(member({ lastVisit: TODAY }), TODAY).aside).toEqual({ text: "Visited today" });
    expect(memberCardLines(member({ lastVisit: "2026-11-09" }), TODAY).aside).toEqual({ text: "Last visit 9 Nov" });
  });

  it("says nothing about visits when there are none, so gyms without check-in see no clutter", () => {
    expect(memberCardLines(member({ lastVisit: null }), TODAY).aside).toBeNull();
  });

  it("marks personal training, and handles a member with no plan", () => {
    expect(memberCardLines(member({ ptActive: true }), TODAY).showPt).toBe(true);
    const none = memberCardLines(member({ state: "NO_PLAN", planName: null, daysLeft: null, endDate: null }), TODAY);
    expect(none.plan).toBe("No plan");
    expect(none.validity).toBeNull();
  });

  it("shows a pending request with its number and age, and no plan line", () => {
    const lines = memberCardLines(member({ status: "PENDING", state: "NO_PLAN", planName: null, requestNo: 23, createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(), batch: null }), TODAY);
    expect(lines.plan).toBeNull();
    expect(lines.showPt).toBe(false);
    expect(lines.contact).toBe("98765 43210");
    expect(lines.validity).toEqual({ text: "Request #23 · 2 hours ago" });
    expect(lines.aside).toBeNull();
  });
});

describe("formatAgo", () => {
  const now = Date.parse("2026-11-28T12:00:00.000Z");
  it("speaks in minutes, hours and days", () => {
    expect(formatAgo("2026-11-28T11:59:40.000Z", now)).toBe("just now");
    expect(formatAgo("2026-11-28T11:55:00.000Z", now)).toBe("5 minutes ago");
    expect(formatAgo("2026-11-28T11:00:00.000Z", now)).toBe("1 hour ago");
    expect(formatAgo("2026-11-25T12:00:00.000Z", now)).toBe("3 days ago");
    expect(formatAgo("2026-11-01T12:00:00.000Z", now)).toBe("1 Nov");
  });
});
