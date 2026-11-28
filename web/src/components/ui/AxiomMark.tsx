/* The Axiom Labs mark: five folded planes. Drawn inline so it needs no file and scales with its text. */
export function AxiomMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 126 103" aria-hidden focusable="false">
      <polygon points="21,47 75,1 63,65" fill="#AEB5C0" />
      <polygon points="75,1 63,65 126,102" fill="#263244" />
      <polygon points="21,47 0,102 29,66" fill="#596374" />
      <polygon points="21,47 29,66 63,65" fill="#111A28" />
      <polygon points="29,66 63,65 0,102" fill="#394455" />
    </svg>
  );
}
