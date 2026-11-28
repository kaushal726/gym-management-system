/* Sign-in screens. Phones get one column (message, then the sign-in card, then the points). Desktops get a
 * split screen: a solid brand panel on the left, the sign-in card on the right, so nothing sits small in the middle. */
import type { ReactNode } from "react";
import { Brand } from "../ui/Brand.tsx";
import { HeroSlides } from "../ui/HeroSlides.tsx";
import { MadeBy } from "../ui/MadeBy.tsx";
import { GymPreview, MemberPreview } from "./AuthPreview.tsx";

export interface AuthPoint {
  icon: ReactNode;
  title: string;
  text: string;
}

interface Props {
  /** Small line above the heading. Leave it out for the GymDesk tagline, or pass null for no line at all. */
  eyebrow?: string | null;
  /** Wrap a word in <em> to paint it in the accent colour. */
  heading: ReactNode;
  text: string;
  points: AuthPoint[];
  children: ReactNode;
  /** Shown under the card, e.g. who is signed in. */
  below?: ReactNode;
  /** Which sample cards the desktop hero shows. */
  preview?: "gym" | "member";
  /** A gym's own page (from its QR): show "Powered by GymDesk" under the sign-in. */
  poweredBy?: boolean;
  /** Phones: a big tile with these letters (a gym's initials) instead of the GymDesk mark. */
  monogram?: string;
  /** Short selling points shown as chips under the text. */
  chips?: string[];
  /** Phones: fill exactly one screen with no scrolling. Only for short screens like the sign-in card. */
  fit?: boolean;
  /** Phones: leave out the big logo, for screens whose card is tall. */
  noArt?: boolean;
  /** Show a gym photo behind the hero: the gym's own when its brand is applied, else the default gym photo. On unless turned off. */
  photo?: boolean;
  /** How many characters the big heading has: a long gym name gets a smaller heading so it fits on the screen. */
  titleLength?: number;
}

/** The GYMDESK headline used wherever there is no gym name to show. */
export const BRAND_HEADING = (
  <>
    GYM<em className="brand-em">DESK</em>
  </>
);

/** The heading size step for a title of this length (see .auth--title-* in layout.css). */
function titleStep(length: number): "long" | "xlong" | null {
  if (length > 32) return "xlong";
  if (length > 16) return "long";
  return null;
}

const FOOT = "Free to run · Works on any phone · Your data stays yours";

function PointsList({ points, className }: { points: AuthPoint[]; className: string }) {
  return (
    <ul className={`${className} enter-stagger`}>
      {points.map((p) => (
        <li key={p.title}>
          <span className="auth__point-icon" aria-hidden>
            {p.icon}
          </span>
          <span>
            <strong>{p.title}</strong>
            <span>{p.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AuthLayout({ eyebrow, heading, text, points, children, below, preview = "gym", poweredBy = false, monogram, chips, fit = false, noArt = false, photo = true, titleLength = 0 }: Props) {
  return (
    <div className={["auth", fit && "auth--fit", (noArt || photo) && "auth--no-art", photo && "auth--photo", titleStep(titleLength) && `auth--title-${titleStep(titleLength)}`].filter(Boolean).join(" ")}>
      <section className="auth__brand" aria-label="About">
        {photo && <HeroSlides />}
        <div className="auth__logo auth__logo--desktop">
          <Brand size={40} tone="dark" />
        </div>
        {!noArt && !photo && (
          <div className="auth__phone-art" aria-hidden>
            {monogram ? <span className="auth__monogram">{monogram}</span> : <img src="/icon.svg" alt="" />}
          </div>
        )}
        <div className="auth__pitch enter">
          {eyebrow !== null && <p className="auth__eyebrow">{eyebrow ?? "Members · Dues · Renewals"}</p>}
          <h1>{heading}</h1>
          <p className="auth__text">{text}</p>
          {chips && (
            <ul className="auth__chips">
              {chips.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
        {preview === "member" ? <MemberPreview /> : <GymPreview />}
        <p className="auth__foot auth__foot--desktop">{FOOT}</p>
      </section>
      <main className="auth__panel">
        <div className="auth__card">
          {children}
          {below}
          {poweredBy && (
            <p className="auth__powered">
              Powered by <Brand size={18} />
            </p>
          )}
        </div>
        {/* On phones the points sit under the card, so the screen reads top to bottom with nothing empty. */}
        <PointsList points={points} className="auth__points auth__points--phone" />
        <p className="auth__foot auth__foot--phone">{FOOT}</p>
        <MadeBy />
      </main>
    </div>
  );
}
