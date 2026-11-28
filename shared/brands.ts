/* A gym's own look: the colours and photos its members see. Brands live in the code (photos in web/public/gyms),
 * so nothing is uploaded and nothing is stored: a gym without an entry uses the GymDesk look. They are keyed by
 * the gym's id, not its web address, so changing the address never loses the theme. */

export interface GymBrand {
  /** Fill for highlights: buttons, bars, the lead tile. Text on it uses `onAccent`. */
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentSoftText: string;
  /** Text and icons that sit on an `accent` fill. */
  onAccent: string;
  /** The accent as text or an icon on a light page (a pale accent would vanish there, so use a darker shade). */
  accentInk: string;
  /** The accent on a black hero. */
  panelAccent: string;
}

const TITAN_GYM: GymBrand = {
  accent: "#1479c8",
  accentStrong: "#0f5f9e",
  accentSoft: "#dcedfb",
  accentSoftText: "#0b4a7a",
  onAccent: "#ffffff",
  accentInk: "#1479c8",
  panelAccent: "#3b9cf0",
};

/** Titan Gym, Ranchi. */
const BRANDS: Record<string, GymBrand> = {
  "01M8G6ECKXNG6D276ZPYC87ZNH": TITAN_GYM,
};

export function brandOf(gymId: string | null | undefined): GymBrand | null {
  return gymId ? (BRANDS[gymId] ?? null) : null;
}
