/* The small maker line at the foot of every page. The company name lives here, so it is changed in one place. */
import { AxiomMark } from "./AxiomMark.tsx";

const MAKER = "Axiom Labs";

export function MadeBy() {
  return (
    <p className="made-by">
      <span>Crafted with care by</span> <AxiomMark className="made-by__mark" /> <strong>{MAKER}</strong>
    </p>
  );
}
