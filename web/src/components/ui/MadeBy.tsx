/* The maker line at the foot of every page: the Axiom Labs mark, and under it who made the app. The company name lives here, so it is changed in one place. */
import { AxiomMark } from "./AxiomMark.tsx";

const MAKER = "Axiom Labs";

export function MadeBy() {
  return (
    <p className="made-by">
      <AxiomMark className="made-by__mark" />
      <span className="made-by__text">
        Crafted with care by <strong>{MAKER}</strong>
      </span>
    </p>
  );
}
