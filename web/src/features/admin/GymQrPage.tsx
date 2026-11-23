/* Gym QR: the join code inside the app, with one-tap download (a ready PNG), share, copy link and print. */
import { useState } from "react";
import { PiCopyBold, PiDownloadSimpleBold, PiPrinterBold, PiShareNetworkBold } from "react-icons/pi";
import { errorMessage } from "../../lib/api.ts";
import { buildQrPoster, downloadBlob } from "../../lib/qrPoster.ts";
import { Button, ButtonLink } from "../../components/ui/Button.tsx";
import { Qr } from "../../components/ui/Qr.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { useAdmin } from "./AdminShell.tsx";

type Busy = "download" | "share" | null;

function canShareFiles(): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
}

export function GymQrPage() {
  const { gym } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState<Busy>(null);
  const joinUrl = `${window.location.origin}/g/${gym.slug}`;
  const lead = gym.checkinEnabled ? "Scan to join or check in" : "Scan to join";
  const fileName = `${gym.slug}-qr.png`;

  const makeImage = () => buildQrPoster({ gymName: gym.name, joinUrl, lead });

  const download = async () => {
    setBusy("download");
    try {
      downloadBlob(await makeImage(), fileName);
      toast("QR image downloaded");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      const file = new File([await makeImage()], fileName, { type: "image/png" });
      await navigator.share({ files: [file], title: gym.name, text: `${lead}: ${joinUrl}` });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast("Link copied");
    } catch {
      toast("Couldn't copy. Press and hold the link to copy it.", "error");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Gym QR</h1>
          <p>Put it at the desk and the entrance. New members scan it to sign up{gym.checkinEnabled ? ", members scan it to check in" : ""}.</p>
        </div>
      </div>

      <section className="card qr-card enter">
        <div className="qr-card__code">
          <span className="qr-card__name">{gym.name}</span>
          <span className="qr-card__lead">{lead}</span>
          <Qr text={joinUrl} size={240} label="QR code to join this gym" />
          <span className="qr-card__url">{joinUrl}</span>
        </div>
        <div className="qr-card__actions">
          <Button variant="primary" block icon={<PiDownloadSimpleBold />} loading={busy === "download"} disabled={busy !== null} onClick={() => void download()}>
            Download QR
          </Button>
          {canShareFiles() && (
            <Button variant="secondary" block icon={<PiShareNetworkBold />} loading={busy === "share"} disabled={busy !== null} onClick={() => void share()}>
              Share
            </Button>
          )}
          <Button variant="secondary" block icon={<PiCopyBold />} onClick={() => void copy()}>
            Copy link
          </Button>
          <ButtonLink href={`/poster/${gym.slug}`} variant="secondary" block icon={<PiPrinterBold />}>
            Print poster
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
