/* The small "made with love" line at the foot of every page. The name lives here, so it is changed in one place. */
import { PiHeartFill } from "react-icons/pi";

const MAKER = "Kaushal";

export function MadeBy() {
  return (
    <p className="made-by">
      Made with <PiHeartFill className="made-by__heart" aria-label="love" /> by {MAKER}
    </p>
  );
}
