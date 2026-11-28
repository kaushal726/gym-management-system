/* Applies a gym's brand to the whole page while its screens are open, then puts the GymDesk look back.
 * It sets CSS variables on the root, so sheets and other pop-ups pick the colours up too. */
import { useLayoutEffect } from "react";
import { brandOf, type GymBrand } from "../../../shared/brands.ts";

const GLOW_ALPHA = 0.4;

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function cssVars(b: GymBrand): Record<string, string> {
  return {
    "--accent": b.accent,
    "--accent-strong": b.accentStrong,
    "--accent-strong-hover": b.accentStrong,
    "--accent-soft": b.accentSoft,
    "--accent-soft-text": b.accentSoftText,
    "--on-accent": b.onAccent,
    "--accent-ink": b.accentInk,
    "--accent-glow": withAlpha(b.accent, GLOW_ALPHA),
    "--panel-accent": b.panelAccent,
    "--focus-ring": `0 0 0 3px ${withAlpha(b.accent, 0.5)}`,
  };
}

/** Themes the page for this gym (if it has a brand) until the screen closes or the gym changes. Returns the brand. */
export function useGymBrand(gymId: string | null | undefined): GymBrand | null {
  const brand = brandOf(gymId);
  useLayoutEffect(() => {
    if (!brand) return;
    const root = document.documentElement;
    const vars = cssVars(brand);
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    root.dataset.brand = "gym";
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
      delete root.dataset.brand;
    };
  }, [brand]);
  return brand;
}
