/* Original cat illustrations for status screens, drawn in SVG with theme colours (nothing uploaded or fetched).
 * They move a little (blink, tail, floating zzz) and stay still for people who turn motion off. */

export type IllustrationKind = "lost" | "locked" | "sleeping" | "happy";

const SIZE = 180;

function CatBody({ eyes = "open" }: { eyes?: "open" | "closed" }) {
  return (
    <g>
      {/* tail */}
      <path className="art-tail" d="M128 138 C 156 134, 162 106, 146 96" fill="none" stroke="var(--art-fur-dark)" strokeWidth="10" strokeLinecap="round" />
      {/* body */}
      <ellipse cx="96" cy="132" rx="40" ry="30" fill="var(--art-fur)" />
      {/* paws */}
      <ellipse cx="78" cy="158" rx="10" ry="6" fill="var(--art-fur-dark)" />
      <ellipse cx="112" cy="158" rx="10" ry="6" fill="var(--art-fur-dark)" />
      {/* head */}
      <path d="M62 64 L 66 34 L 84 52 Z" fill="var(--art-fur)" />
      <path d="M130 64 L 126 34 L 108 52 Z" fill="var(--art-fur)" />
      <path d="M67 42 L 70 56 L 79 52 Z" fill="var(--art-pink)" />
      <path d="M125 42 L 122 56 L 113 52 Z" fill="var(--art-pink)" />
      <circle cx="96" cy="78" r="36" fill="var(--art-fur)" />
      {/* stripes */}
      <path d="M90 44 q 6 8 12 0" fill="none" stroke="var(--art-fur-dark)" strokeWidth="3" strokeLinecap="round" />
      <path d="M86 52 q 10 8 20 0" fill="none" stroke="var(--art-fur-dark)" strokeWidth="3" strokeLinecap="round" />
      {/* face */}
      {eyes === "open" ? (
        <g className="art-eyes">
          <ellipse cx="82" cy="78" rx="5" ry="6.5" fill="var(--art-ink)" />
          <ellipse cx="110" cy="78" rx="5" ry="6.5" fill="var(--art-ink)" />
          <circle cx="83.5" cy="75.5" r="1.6" fill="#fff" />
          <circle cx="111.5" cy="75.5" r="1.6" fill="#fff" />
        </g>
      ) : (
        <g>
          <path d="M76 79 q 6 5 12 0" fill="none" stroke="var(--art-ink)" strokeWidth="3" strokeLinecap="round" />
          <path d="M104 79 q 6 5 12 0" fill="none" stroke="var(--art-ink)" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      <path d="M93 88 L 99 88 L 96 92 Z" fill="var(--art-pink)" />
      <path d="M96 92 q -4 5 -8 2 M96 92 q 4 5 8 2" fill="none" stroke="var(--art-ink)" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 88 L 52 84 M70 93 L 52 95 M122 88 L 140 84 M122 93 L 140 95" stroke="var(--art-ink)" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <ellipse cx="74" cy="90" rx="5" ry="3" fill="var(--art-pink)" opacity="0.5" />
      <ellipse cx="118" cy="90" rx="5" ry="3" fill="var(--art-pink)" opacity="0.5" />
    </g>
  );
}

function Extra({ kind }: { kind: IllustrationKind }) {
  switch (kind) {
    case "lost":
      return (
        <g className="art-float">
          <circle cx="150" cy="40" r="16" fill="var(--accent-soft)" />
          <text x="150" y="47" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--accent-strong)" fontFamily="var(--font-sans)">
            ?
          </text>
        </g>
      );
    case "locked":
      return (
        <g className="art-float">
          <rect x="136" y="38" width="28" height="24" rx="6" fill="var(--accent-strong)" />
          <path d="M142 38 v -6 a 8 8 0 0 1 16 0 v 6" fill="none" stroke="var(--accent-strong)" strokeWidth="4" />
          <circle cx="150" cy="50" r="3" fill="#fff" />
        </g>
      );
    case "sleeping":
      return (
        <g fill="var(--accent-strong)" fontFamily="var(--font-sans)" fontWeight="700">
          <text className="art-zzz" x="136" y="50" fontSize="16">
            z
          </text>
          <text className="art-zzz art-zzz--2" x="148" y="36" fontSize="20">
            z
          </text>
          <text className="art-zzz art-zzz--3" x="162" y="20" fontSize="24">
            z
          </text>
        </g>
      );
    case "happy":
      return (
        <g className="art-float" fill="var(--warning)">
          <path d="M150 24 l 3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" />
          <path d="M36 40 l 2 5 5 .5 -4 3.5 1 5 -4 -2.5 -4 2.5 1 -5 -4 -3.5 5 -.5 z" opacity="0.8" />
        </g>
      );
  }
}

export function Illustration({ kind, size = SIZE }: { kind: IllustrationKind; size?: number }) {
  return (
    <svg className="art" width={size} height={size} viewBox="0 0 192 192" role="img" aria-hidden>
      <ellipse cx="96" cy="166" rx="58" ry="8" fill="var(--art-shadow)" />
      <CatBody eyes={kind === "sleeping" ? "closed" : "open"} />
      <Extra kind={kind} />
    </svg>
  );
}
