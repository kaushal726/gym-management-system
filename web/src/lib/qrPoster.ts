/* Draws the gym's join QR as a share-ready PNG (gym name, "Scan to join", the code, the link) in the browser.
 * Nothing is uploaded: the image is built on a canvas and handed to the browser as a download. */
import QRCode from "qrcode";

const WIDTH = 1080;
const HEIGHT = 1350;
const QR_SIZE = 640;
const PAD = 90;
const INK = "#0e0e10";
const MUTED = "#66666e";
const ACCENT = "#0b8277";
const FONT = '"Archivo Variable", "Archivo", system-ui, sans-serif';
const MAX_TITLE_LINES = 2;

/** Splits text into at most `maxLines` lines that fit `maxWidth`; the last line gets an ellipsis if cut. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

export interface QrPosterInput {
  gymName: string;
  joinUrl: string;
  lead: string;
}

/** Builds the poster image and resolves with a PNG blob. */
export async function buildQrPoster({ gymName, joinUrl, lead }: QrPosterInput): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't make the image on this device.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = INK;
  ctx.font = `800 84px ${FONT}`;
  const titleLines = wrapLines(ctx, gymName, WIDTH - PAD * 2, MAX_TITLE_LINES);
  let y = 170;
  for (const l of titleLines) {
    ctx.fillText(l, WIDTH / 2, y);
    y += 92;
  }

  ctx.fillStyle = ACCENT;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(lead, WIDTH / 2, y + 10);

  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, joinUrl, { width: QR_SIZE, margin: 1, errorCorrectionLevel: "M", color: { dark: INK, light: "#ffffff" } });
  const qrTop = y + 60;
  ctx.drawImage(qr, (WIDTH - QR_SIZE) / 2, qrTop, QR_SIZE, QR_SIZE);

  ctx.fillStyle = MUTED;
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(wrapLines(ctx, joinUrl, WIDTH - PAD * 2, 1)[0], WIDTH / 2, qrTop + QR_SIZE + 70);

  ctx.fillStyle = INK;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText("GYMDESK", WIDTH / 2, HEIGHT - 70);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image on this device."))), "image/png"));
}

/** Hands a blob to the browser as a file download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
