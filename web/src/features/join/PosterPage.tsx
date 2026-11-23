/* /poster/:slug — a printable A4 poster with the gym's QR code for the desk and the entrance. */
import { FiArrowLeft, FiPrinter } from "react-icons/fi";
import type { GymEntry } from "../../../../shared/api.ts";
import { useApi } from "../../lib/useApi.ts";
import { Button } from "../../components/ui/Button.tsx";
import { ErrorState, Skeleton } from "../../components/ui/Feedback.tsx";
import { Qr } from "../../components/ui/Qr.tsx";
import { Brand } from "../../components/ui/Brand.tsx";

export function PosterPage({ slug }: { slug: string }) {
  const { data, error, reload } = useApi<GymEntry>(`/public/gyms/${slug}`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <Skeleton height="100%" />;
  const url = `${window.location.origin}/g/${slug}`;
  return (
    <div className="poster">
      <div className="poster__sheet">
        <Brand size={56} />
        <h1 className="poster__title">{data.gym.name}</h1>
        <p className="poster__lead">{data.gym.checkinEnabled ? "Scan to join or check in" : "Scan to join"}</p>
        <Qr text={url} size={320} label="QR code for this gym" />
        <ol className="poster__steps">
          <li>Open your phone camera and point it at the code</li>
          <li>Sign in with Google</li>
          <li>{data.gym.checkinEnabled ? "New here? Fill your details. Already a member? Tap Check in." : "Fill your details and show the screen at the desk"}</li>
        </ol>
        <p className="poster__url">{url}</p>
      </div>
      <div className="poster__print">
        {window.history.length > 1 && (
          <Button variant="secondary" icon={<FiArrowLeft />} onClick={() => window.history.back()}>
            Back
          </Button>
        )}
        <Button variant="primary" icon={<FiPrinter />} onClick={() => window.print()}>
          Print
        </Button>
      </div>
    </div>
  );
}
