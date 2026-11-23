/* A QR code drawn in the browser from text (a link or a UPI address): nothing is uploaded or fetched. */
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function Qr({ text, size = 200, label }: { text: string; size?: number; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    void QRCode.toCanvas(canvas.current, text, { width: size, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
  }, [text, size]);
  return <canvas ref={canvas} role="img" aria-label={label} width={size} height={size} style={{ borderRadius: 8, background: "#fff" }} />;
}

export function upiLink(upiId: string, payeeName: string, amountPaise?: number): string {
  const params = new URLSearchParams({ pa: upiId, pn: payeeName, cu: "INR" });
  if (amountPaise && amountPaise > 0) params.set("am", (amountPaise / 100).toFixed(2));
  return `upi://pay?${params.toString()}`;
}
