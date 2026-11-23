/* Sign-in screens. Phones get one column (message, then the sign-in card, then the points). Desktops get a
 * split screen: a solid brand panel on the left, the sign-in card on the right, so nothing sits small in the middle. */
import type { ReactNode } from "react";

export interface AuthPoint {
  icon: ReactNode;
  title: string;
  text: string;
}

interface Props {
  /** Small line above the heading, e.g. the gym's address. */
  eyebrow?: string;
  heading: string;
  text: string;
  points: AuthPoint[];
  children: ReactNode;
  /** Shown under the card, e.g. who is signed in. */
  below?: ReactNode;
}

export function AuthLayout({ eyebrow, heading, text, points, children, below }: Props) {
  return (
    <div className="auth">
      <section className="auth__brand" aria-label="About">
        <div className="auth__logo">
          <img src="/icon.svg" alt="" width={36} height={36} />
          <span>GymDesk</span>
        </div>
        <div className="auth__pitch enter">
          {eyebrow && <p className="auth__eyebrow">{eyebrow}</p>}
          <h1>{heading}</h1>
          <p className="auth__text">{text}</p>
        </div>
        <ul className="auth__points enter-stagger">
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
        <p className="auth__foot">Free to run · Works on any phone · Your data stays yours</p>
      </section>
      <main className="auth__panel">
        <div className="auth__card">
          {children}
          {below}
        </div>
      </main>
    </div>
  );
}
