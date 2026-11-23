/* The owner fixing a plan a member already took: another plan, another start date or another price.
 * Pure rules shared by the API and the form, so both agree on what is allowed. */
import { planEndDate, type IsoDate, type PlanLength } from "./dates.ts";
import type { Paise } from "./money.ts";

export interface EditableSubscription extends PlanLength {
  startDate: IsoDate;
  endDate: IsoDate;
  joiningFeePaise: Paise;
  /** Payments minus refunds, ignoring voided entries. */
  paidPaise: Paise;
  freezeDaysUsed: number;
}

export interface SubscriptionChange extends PlanLength {
  startDate: IsoDate;
  finalPricePaise: Paise;
}

export type EditProblem = "PRICE_BELOW_PAID" | "DATES_LOCKED_BY_FREEZE" | "NEGATIVE_PRICE";

export const EDIT_PROBLEM_MESSAGE: Record<EditProblem, string> = {
  PRICE_BELOW_PAID: "The price can't be less than what has already been paid. Refund the difference by cancelling instead.",
  DATES_LOCKED_BY_FREEZE: "This plan has a freeze, so its dates and length can't change. The price can still change.",
  NEGATIVE_PRICE: "The price can't be below zero.",
};

function sameLength(a: PlanLength, b: PlanLength): boolean {
  return a.durationMonths === b.durationMonths && a.durationDays === b.durationDays;
}

/**
 * Works out the edited plan's end date, or why the change is not allowed. Keeping the dates and length keeps
 * the end date as it is (it already includes any freeze); otherwise the end date follows the new start and length.
 */
export function planEdit(sub: EditableSubscription, change: SubscriptionChange): { endDate: IsoDate } | { problem: EditProblem } {
  if (change.finalPricePaise < 0) return { problem: "NEGATIVE_PRICE" };
  if (change.finalPricePaise + sub.joiningFeePaise < sub.paidPaise) return { problem: "PRICE_BELOW_PAID" };
  const datesKept = change.startDate === sub.startDate && sameLength(sub, change);
  if (datesKept) return { endDate: sub.endDate };
  if (sub.freezeDaysUsed > 0) return { problem: "DATES_LOCKED_BY_FREEZE" };
  return { endDate: planEndDate(change.startDate, change) };
}
