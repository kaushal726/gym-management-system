/* The gym's join poster as an image on screen. It is the very drawing that gets downloaded and printed. */
import { useEffect, useRef, useState } from "react";
import { POSTER_HEIGHT, POSTER_WIDTH, drawQrPoster, type QrPosterInput } from "../../lib/qrPoster.ts";
import { Skeleton } from "./Feedback.tsx";

export function QrPosterView({ gymId, gymName, joinUrl, lead }: QrPosterInput) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvas.current) return;
    let current = true;
    setReady(false);
    setFailed(false);
    drawQrPoster(canvas.current, { gymId, gymName, joinUrl, lead })
      .then(() => current && setReady(true))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [gymId, gymName, joinUrl, lead]);

  return (
    <div className="qr-poster" style={{ aspectRatio: `${POSTER_WIDTH} / ${POSTER_HEIGHT}` }}>
      {!ready && !failed && <Skeleton height="100%" radius={28} />}
      {failed && <p className="muted">Couldn't draw the poster on this device.</p>}
      <canvas ref={canvas} className="qr-poster__canvas" role="img" aria-label={`Join poster for ${gymName}`} hidden={!ready} />
    </div>
  );
}
