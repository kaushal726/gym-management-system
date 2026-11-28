/* The photos behind a gym hero, the same global photos for every gym. On the sign-in and join screens they take turns, one
 * after another with a soft cross-fade; a photo stays still while shown and only moves as it changes. It starts on a random
 * one, so each visit opens differently. On the member page one photo stays put (`still`). The look and the timing are in
 * layout.css (.hero-slides). */
import { useState, type CSSProperties } from "react";
import { HERO_PHOTO_KEYS, heroSlideVars, type HeroPhotoKey } from "../../lib/heroPhotos.ts";

/** With `still`, one photo stays put and never changes (the member page); without it, all the photos take turns. */
export function HeroSlides({ still }: { still?: HeroPhotoKey }) {
  const [start] = useState(() => Math.floor(Math.random() * HERO_PHOTO_KEYS.length));
  if (still) {
    return (
      <div className="hero-slides" aria-hidden>
        <span className="hero-slide hero-slide--still" style={heroSlideVars(still) as CSSProperties} />
      </div>
    );
  }
  return (
    <div className="hero-slides" aria-hidden>
      {HERO_PHOTO_KEYS.map((_, i) => {
        const key = HERO_PHOTO_KEYS[(start + i) % HERO_PHOTO_KEYS.length];
        return <span key={key} className="hero-slide" style={{ ...heroSlideVars(key), "--i": i } as CSSProperties} />;
      })}
    </div>
  );
}
