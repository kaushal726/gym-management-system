/* The default gym photos. A gym without its own brand shows all of them in turn behind its hero (see HeroSlides).
 * Files live in public/gyms/default as <key>-wide-<px>.webp and <key>-tall-<px>.webp. */

export const HERO_PHOTO_KEYS = ["treadmills", "wood", "gym-dark", "dumbbells", "barbell", "deadlift"] as const;
export type HeroPhotoKey = (typeof HERO_PHOTO_KEYS)[number];

const WIDE_SIZES = [1280, 2400] as const;
const TALL_SIZES = [720, 1280] as const;

function imageSet(key: HeroPhotoKey, kind: "wide" | "tall", sizes: readonly [number, number]): string {
  const file = (px: number) => `url("/gyms/default/${key}-${kind}-${px}.webp")`;
  return `image-set(${file(sizes[0])} 1x, ${file(sizes[1])} 2x)`;
}

/** The two CSS variables one slide reads: the wide photo (tablets, laptops) and the tall one (phones). */
export function heroSlideVars(key: HeroPhotoKey): Record<string, string> {
  return { "--slide-wide": imageSet(key, "wide", WIDE_SIZES), "--slide-tall": imageSet(key, "tall", TALL_SIZES) };
}
