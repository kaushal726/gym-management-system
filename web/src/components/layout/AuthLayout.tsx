/* Sign-in screens. Phones get one column (message, then the sign-in card, then the points). Desktops get a
 * split screen: a solid brand panel on the left, the sign-in card on the right, so nothing sits small in the middle. */
import type { ReactNode } from "react";
import { Brand } from "../ui/Brand.tsx";

export interface AuthPoint {
  icon: ReactNode;
  title: string;
  text: string;
}

interface Props {
  /** Small line above the heading, e.g. the gym's address. */
  eyebrow?: string;
  /** Wrap a word in <em> to paint it in the accent colour. */
  heading: ReactNode;
  text: string;
  points: AuthPoint[];
  children: ReactNode;
  /** Shown under the card, e.g. who is signed in. */
  below?: ReactNode;
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

export function AuthLayout({ eyebrow, heading, text, points, children, below }: Props) {
  return (
    <div className="auth">
      <section className="auth__brand" aria-label="About">
        <div className="auth__logo">
          <Brand size={40} tone="dark" />
        </div>
        <div className="auth__hero">
          <div className="auth__pitch enter">
            {eyebrow && <p className="auth__eyebrow">{eyebrow}</p>}
            <h1>{heading}</h1>
            <p className="auth__text">{text}</p>
          </div>
          <div className="auth__hero-mark" aria-hidden>
            <img src="/icon.svg" alt="" />
          </div>
        </div>
        <PointsList points={points} className="auth__points auth__points--desktop" />
        <p className="auth__foot auth__foot--desktop">{FOOT}</p>
      </section>
      <main className="auth__panel">
        <div className="auth__card">
          {children}
          {below}
        </div>
        {/* On phones the points sit under the card, so the screen reads top to bottom with nothing empty. */}
        <PointsList points={points} className="auth__points auth__points--phone" />
        <p className="auth__foot auth__foot--phone">{FOOT}</p>
      </main>
    </div>
  );
}
