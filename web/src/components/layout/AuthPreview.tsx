/* A taste of the app on the sign-in hero: a few small cards drifting gently, so people see what GymDesk does
 * before they sign in. Sample numbers only, nothing real. */
import { PiBellBold, PiCheckCircleBold, PiTrendUpBold } from "react-icons/pi";

function MiniRing({ value, label }: { value: number; label: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className="mini-ring" aria-hidden>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 26 26)" />
      </svg>
      <span>{label}</span>
    </span>
  );
}

export function GymPreview() {
  return (
    <div className="preview" aria-hidden>
      <div className="preview__card preview__card--a">
        <span className="preview__label">
          <PiTrendUpBold /> Collected today
        </span>
        <span className="preview__value">₹27,700</span>
        <span className="preview__hint">11 payments · Cash ₹2,200 · UPI ₹25,500</span>
      </div>
      <div className="preview__card preview__card--b">
        <MiniRing value={0.94} label="29" />
        <span>
          <strong>Meera Joshi</strong>
          <span className="preview__hint">Monthly · 29 days left</span>
        </span>
      </div>
      <div className="preview__card preview__card--c">
        <span className="preview__icon">
          <PiBellBold />
        </span>
        <span>
          <strong>Reminder sent</strong>
          <span className="preview__hint">Rahul's plan ends tomorrow</span>
        </span>
      </div>
    </div>
  );
}

export function MemberPreview() {
  return (
    <div className="preview" aria-hidden>
      <div className="preview__card preview__card--a">
        <span className="preview__label">Your plan</span>
        <span className="preview__value">29 days left</span>
        <span className="preview__hint">Monthly · valid till 22 Dec</span>
      </div>
      <div className="preview__card preview__card--b">
        <span className="preview__icon">
          <PiCheckCircleBold />
        </span>
        <span>
          <strong>₹2,000 paid</strong>
          <span className="preview__hint">Receipt #11 · UPI</span>
        </span>
      </div>
      <div className="preview__card preview__card--c">
        <span className="preview__icon">
          <PiBellBold />
        </span>
        <span>
          <strong>Renew soon</strong>
          <span className="preview__hint">Your plan ends in 5 days</span>
        </span>
      </div>
    </div>
  );
}
