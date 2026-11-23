/* The member list filters and the dashboard counts use the same rules, so a number on the dashboard always
 * matches the list it opens. */
import type { MemberFilter, MemberListItem } from "./api.ts";
import { EXPIRING_WINDOW_DAYS } from "./constants.ts";

export function matchesFilter(item: MemberListItem, filter: MemberFilter): boolean {
  if (filter === "archived") return item.archived;
  if (item.archived || item.status === "REJECTED") return false;
  const joined = item.status === "JOINED";
  switch (filter) {
    case "all":
      return true;
    case "pending":
      return item.status === "PENDING";
    case "leads":
      return item.status === "LEAD";
    case "active":
      return joined && (item.state === "ACTIVE" || item.state === "FROZEN");
    case "expiring":
      return joined && (item.state === "ACTIVE" || item.state === "FROZEN") && item.daysLeft != null && item.daysLeft <= EXPIRING_WINDOW_DAYS;
    case "grace":
      return joined && item.state === "GRACE";
    case "expired":
      return joined && item.state === "EXPIRED";
    case "frozen":
      return joined && item.state === "FROZEN";
    case "dues":
      return item.duePaise > 0;
  }
}

export function matchesSearch(item: MemberListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return item.name.toLowerCase().includes(q) || (digits.length >= 3 && item.phone.includes(digits));
}

export const FILTER_LABEL: Record<MemberFilter, string> = {
  all: "All",
  pending: "Pending",
  active: "Active",
  expiring: "Expiring",
  grace: "In grace",
  expired: "Expired",
  dues: "Dues",
  frozen: "Frozen",
  leads: "Leads",
  archived: "Archived",
};
