/* Indian mobile numbers are stored as 10 digits; WhatsApp links add the country code. */

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** "+91 98765-43210", "098765 43210" and "9876543210" all become "9876543210"; anything else is null. */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return INDIAN_MOBILE.test(digits) ? digits : null;
}

export function formatMobile(phone: string): string {
  return phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
}

/** Opens WhatsApp on the sender's own phone with the message typed in; nothing is sent until they tap send. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;
}

export function callLink(phone: string): string {
  return `tel:+91${phone}`;
}
