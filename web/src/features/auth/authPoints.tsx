/* What the sign-in screens promise, for gym staff and for members. */
import { PiBellDuotone, PiCalendarBlankDuotone, PiDeviceMobileDuotone, PiFileTextDuotone, PiShieldCheckDuotone, PiUserPlusDuotone, PiWalletDuotone } from "react-icons/pi";
import type { AuthPoint } from "../../components/layout/AuthLayout.tsx";

export const GYM_POINTS: AuthPoint[] = [
  { icon: <PiUserPlusDuotone />, title: "Members join from a QR code", text: "They fill their own details. You see them waiting at the desk." },
  { icon: <PiWalletDuotone />, title: "Plan and payment in one step", text: "Part payments become dues, and every rupee has a receipt." },
  { icon: <PiBellDuotone />, title: "Reminders go out on their own", text: "Expiry, dues and lapsed members, plus a WhatsApp follow-up list." },
  { icon: <PiShieldCheckDuotone />, title: "Only the owner sees sales", text: "Staff run the desk. Voids and refunds need the owner and a reason." },
];

export const MEMBER_POINTS: AuthPoint[] = [
  { icon: <PiDeviceMobileDuotone />, title: "Sign up in a minute", text: "Fill your details once. The desk picks your plan." },
  { icon: <PiCalendarBlankDuotone />, title: "Your plan at a glance", text: "Days left, renewals and freezes, always up to date." },
  { icon: <PiBellDuotone />, title: "Renewal reminders", text: "A nudge before your plan ends, so you never miss a day." },
  { icon: <PiFileTextDuotone />, title: "Every receipt in one place", text: "See what you paid and what's pending." },
];
