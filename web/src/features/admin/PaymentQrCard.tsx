/* The gym's payment QR for its desk: drawn from the saved UPI ID (nothing is uploaded), with a PNG to download and print.
 * It has no amount, so the payer types it; members with dues get a QR with their amount on their own page. */
import { PiDownloadSimpleBold } from "react-icons/pi";
import QRCode from "qrcode";
import { Button } from "../../components/ui/Button.tsx";
import { Qr, upiLink } from "../../components/ui/Qr.tsx";
import { useToast } from "../../components/ui/Toast.tsx";

const DOWNLOAD_SIZE = 1024;

function fileName(gymName: string): string {
  return `${gymName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "gym"}-payment-qr.png`;
}

export function PaymentQrCard({ upiId, gymName }: { upiId: string; gymName: string }) {
  const toast = useToast();
  const link = upiLink(upiId, gymName);
  const download = async () => {
    try {
      const url = await QRCode.toDataURL(link, { width: DOWNLOAD_SIZE, margin: 4, errorCorrectionLevel: "M" });
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName(gymName);
      a.click();
    } catch {
      toast("Couldn't make the image on this device", "error");
    }
  };
  return (
    <section className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
      <h2>Payment QR</h2>
      <Qr text={link} size={200} label={`UPI QR to pay ${gymName}`} />
      <p className="muted" style={{ fontSize: 13 }}>
        Scan with any UPI app to pay <strong>{upiId}</strong>. Put it at the desk.
      </p>
      <Button icon={<PiDownloadSimpleBold />} onClick={() => void download()}>
        Download QR
      </Button>
    </section>
  );
}
