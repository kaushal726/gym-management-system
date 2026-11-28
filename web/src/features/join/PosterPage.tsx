/* /poster/:slug — a printable A4 poster with the gym's QR code for the desk and the entrance. */
import { PiArrowLeftBold, PiPrinterBold } from "react-icons/pi";
import type { GymEntry } from "../../../../shared/api.ts";
import { useApi } from "../../lib/useApi.ts";
import { Button } from "../../components/ui/Button.tsx";
import { ErrorState, Skeleton } from "../../components/ui/Feedback.tsx";
import { QrPosterView } from "../../components/ui/QrPosterView.tsx";

export function PosterPage({ slug }: { slug: string }) {
  const { data, error, reload } = useApi<GymEntry>(`/public/gyms/${slug}`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <Skeleton height="100%" />;
  const url = `${window.location.origin}/g/${slug}`;
  return (
    <div className="poster">
      <QrPosterView gymId={data.gym.id} gymName={data.gym.name} joinUrl={url} lead={data.gym.checkinEnabled ? "Scan to join or check in" : "Scan to join"} />
      <div className="poster__print">
        {window.history.length > 1 && (
          <Button variant="secondary" icon={<PiArrowLeftBold />} onClick={() => window.history.back()}>
            Back
          </Button>
        )}
        <Button variant="primary" icon={<PiPrinterBold />} onClick={() => window.print()}>
          Print
        </Button>
      </div>
    </div>
  );
}
