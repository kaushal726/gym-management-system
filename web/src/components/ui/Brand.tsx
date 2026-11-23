/* The GymDesk logo: the 3D plate mark and the GYMDESK wordmark. One component, so the brand looks the same everywhere. */

interface BrandProps {
  /** Mark size in px; the wordmark scales with it. */
  size?: number;
  /** "dark" for black backgrounds (white GYM), "light" for white ones. */
  tone?: "light" | "dark";
  /** Mark only, without the word. */
  markOnly?: boolean;
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return <img src="/icon.svg" alt="" width={size} height={size} className="brand-mark" style={{ borderRadius: Math.round(size * 0.23) }} />;
}

export function Brand({ size = 32, tone = "light", markOnly = false }: BrandProps) {
  return (
    <span className={`brand-lockup brand-lockup--${tone}`} style={{ fontSize: Math.round(size * 0.62) }}>
      <BrandMark size={size} />
      {!markOnly && (
        <span className="brand-word" aria-label="GymDesk">
          GYM<span>DESK</span>
        </span>
      )}
    </span>
  );
}
