/* Turns an audit row's before/after snapshot into lines a gym owner can read: "Price: ₹1,500 → ₹4,000". */
import { BATCH_LABEL } from "../../../../shared/constants.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { formatDate } from "../../lib/format.ts";
import { MODE_LABEL, ROLE_LABEL } from "../../lib/states.ts";

const FIELD_LABEL: Record<string, string> = {
  plan: "Plan",
  startDate: "Start date",
  endDate: "End date",
  finalPricePaise: "Price",
  listPricePaise: "List price",
  joiningFeePaise: "Joining fee",
  amountPaise: "Amount",
  pricePaise: "Price",
  name: "Name",
  phone: "Mobile",
  email: "Gmail",
  inviteEmail: "Gmail",
  dob: "Date of birth",
  gender: "Gender",
  batch: "Batch",
  emergencyName: "Emergency contact",
  emergencyPhone: "Emergency mobile",
  guardianName: "Guardian",
  guardianPhone: "Guardian mobile",
  mode: "Paid by",
  role: "Role",
  active: "Active",
  upiId: "UPI ID",
  graceDays: "Grace days",
  checkinEnabled: "Check-in",
  checkinRadiusM: "Check-in radius (m)",
  reminderHour: "Reminder time",
  durationMonths: "Months",
  durationDays: "Days",
  maxFreezeDays: "Freeze days",
  trainerCommissionPct: "Trainer share (%)",
};

/** Enum values that have a friendly name, whichever field they appear in. */
const VALUE_LABEL: Record<string, string> = {
  ...BATCH_LABEL,
  ...ROLE_LABEL,
  ...MODE_LABEL,
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "checkinRadiusM" → "Checkin radius m", for fields without a label. */
function humanize(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && key.endsWith("Paise")) return formatRupees(value);
  if (typeof value === "string" && ISO_DATE.test(value)) return formatDate(value);
  if (typeof value === "string" && value in VALUE_LABEL) return VALUE_LABEL[value];
  return String(value);
}

/** One readable line per field whose value changed between the two snapshots. */
export function describeChanges(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  return Object.keys(a)
    .filter((k) => k in b && JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => `${FIELD_LABEL[k] ?? humanize(k)}: ${formatValue(k, b[k])} → ${formatValue(k, a[k])}`);
}
