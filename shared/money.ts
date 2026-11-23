/* Money is always whole paise (integers). Dues are worked out from payments every time, never stored. */

export type Paise = number;

const RUPEE_INPUT = /^\d+(\.\d{1,2})?$/;
/** No single amount above ₹10,00,000 is accepted: anything larger is almost certainly a typo. */
export const MAX_AMOUNT_PAISE: Paise = 10_00_000 * 100;

/** Reads what a person typed ("1500", "1,500", "₹1,500.50") as paise; null if it is not a valid amount. */
export function rupeesToPaise(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!RUPEE_INPUT.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) && paise <= MAX_AMOUNT_PAISE ? paise : null;
}

const RUPEES = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatRupees(paise: Paise): string {
  return RUPEES.format(paise / 100);
}

/** The value to prefill in an amount input: "1500" or "1500.50". */
export function paiseToInput(paise: Paise): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export interface PaymentLike {
  amountPaise: Paise;
  voided: boolean;
}

/** Money actually kept: payments minus refunds, ignoring voided entries. */
export function netPaid(payments: readonly PaymentLike[]): Paise {
  return payments.reduce((sum, p) => (p.voided ? sum : sum + p.amountPaise), 0);
}

export interface ChargeLike {
  finalPricePaise: Paise;
  joiningFeePaise: Paise;
  cancelled: boolean;
}

export function totalCharge(charge: ChargeLike): Paise {
  return charge.finalPricePaise + charge.joiningFeePaise;
}

/** What the member still owes on one subscription. A cancelled subscription owes nothing. */
export function dueOf(charge: ChargeLike, payments: readonly PaymentLike[]): Paise {
  if (charge.cancelled) return 0;
  return Math.max(0, totalCharge(charge) - netPaid(payments));
}

/** The largest payment the desk may take now without the member paying more than they owe. */
export function maxPaymentNow(charge: ChargeLike, payments: readonly PaymentLike[]): Paise {
  return dueOf(charge, payments);
}

/** The most that can be refunded on cancelling: what was paid and not already refunded. */
export function maxRefund(payments: readonly PaymentLike[]): Paise {
  return Math.max(0, netPaid(payments));
}

/**
 * A payment may be voided only if what remains still covers every refund already given;
 * otherwise money that was handed back would turn into "dues" the member never owed.
 */
export function canVoid(payments: readonly PaymentLike[], target: PaymentLike): boolean {
  if (target.voided || target.amountPaise <= 0) return false;
  return netPaid(payments) - target.amountPaise >= 0;
}

/** The unpaid-for share of a plan, offered as a suggested credit when someone upgrades mid-plan. */
export function unusedValue(finalPricePaise: Paise, totalDays: number, daysLeft: number): Paise {
  if (totalDays <= 0 || daysLeft <= 0) return 0;
  return Math.round((finalPricePaise * Math.min(daysLeft, totalDays)) / totalDays);
}
