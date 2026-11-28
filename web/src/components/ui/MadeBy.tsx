/* The small maker line at the foot of every page. The company name lives here, so it is changed in one place. */
const MAKER = "Axiom Labs";

export function MadeBy() {
  return (
    <p className="made-by">
      Crafted with care by <strong>{MAKER}</strong>
    </p>
  );
}
