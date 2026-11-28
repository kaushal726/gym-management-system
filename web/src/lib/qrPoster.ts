/* The gym's join poster, drawn in the browser on a canvas: the gym's photo and name, a styled QR code on a card,
 * "Scan me" and three steps. The same drawing is shown on the QR page, printed, and downloaded as a PNG, so what
 * the owner sees is what the walls get. Nothing is uploaded; there is deliberately no web address on it. */
import { brandOf } from "../../../shared/brands.ts";
import { drawStyledQr } from "./styledQr.ts";

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1560;

const PAD = 80;
const HERO_HEIGHT = 560;
const CARD_SIDE = 760;
const CARD_TOP = 490;
const CARD_PAD = 30;
const INK = "#0e0e10";
const MUTED = "rgba(255, 255, 255, 0.62)";
const DEFAULT_ACCENT = "#3b9cf0";
/** The photo on every gym's poster: one of the global gym photos (public/gyms/default). */
const POSTER_PHOTO = "/gyms/default/gym-dark-tall-1280.webp";
const FONT = '"Archivo Variable", "Archivo", system-ui, sans-serif';
const MAX_NAME_LINES = 2;
const NAME_SIZES = [118, 104, 92, 82, 74, 66];
const STEPS = ["Scan the code", "Sign in with Google", "Show it at the desk"];

export interface QrPosterInput {
  gymId: string;
  gymName: string;
  /** What the code opens. It is encoded in the QR, never printed. */
  joinUrl: string;
  /** The line above the name, such as "Scan to join". */
  lead: string;
}

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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Fills the top band with the gym's photo (cropped to fit), fading into the poster's dark base. */
function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(POSTER_WIDTH / img.width, HERO_HEIGHT / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, POSTER_WIDTH, HERO_HEIGHT);
  ctx.clip();
  ctx.drawImage(img, (POSTER_WIDTH - w) / 2, 0, w, h);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, 0, 0, HERO_HEIGHT);
  fade.addColorStop(0, "rgba(14, 14, 16, 0.55)");
  fade.addColorStop(1, INK);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, POSTER_WIDTH, HERO_HEIGHT);
}

/** A gym with no photo gets a big soft ring instead, like the hero cards in the app. */
function drawRing(ctx: CanvasRenderingContext2D, accent: string) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 70;
  ctx.beginPath();
  ctx.arc(POSTER_WIDTH - 40, 60, 260, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}

/** Draws the poster onto `canvas`, resizing it to POSTER_WIDTH x POSTER_HEIGHT. */
export async function drawQrPoster(canvas: HTMLCanvasElement, input: QrPosterInput): Promise<void> {
  const brand = brandOf(input.gymId);
  const accent = brand?.panelAccent ?? DEFAULT_ACCENT;
  await Promise.all([document.fonts?.load(`900 100px ${FONT}`), document.fonts?.load(`600 30px ${FONT}`)]);
  const photo = await loadImage(POSTER_PHOTO);

  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't make the image on this device.");

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  if (photo) drawPhoto(ctx, photo);
  else drawRing(ctx, accent);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = `800 40px ${FONT}`;
  setSpacing(ctx, 7);
  ctx.fillText(input.lead.toUpperCase(), PAD, 128);
  setSpacing(ctx, 0);

  ctx.fillStyle = "#ffffff";
  const name = input.gymName.toUpperCase();
  const nameWidth = POSTER_WIDTH - PAD * 2;
  // The biggest size at which the whole name fits on two lines; a very long name is cut with "…" at the smallest.
  const nameSize =
    NAME_SIZES.find((size) => {
      ctx.font = `900 ${size}px ${FONT}`;
      return wrapLines(ctx, name, nameWidth, MAX_NAME_LINES + 1).length <= MAX_NAME_LINES;
    }) ?? NAME_SIZES[NAME_SIZES.length - 1];
  ctx.font = `900 ${nameSize}px ${FONT}`;
  const nameLines = wrapLines(ctx, name, nameWidth, MAX_NAME_LINES);
  let y = 126 + nameSize;
  for (const line of nameLines) {
    ctx.fillText(line, PAD, y);
    y += nameSize;
  }
  ctx.fillStyle = accent;
  ctx.fillRect(PAD, y - nameSize + 28, 140, 14);

  const cardX = (POSTER_WIDTH - CARD_SIDE) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(cardX, CARD_TOP, CARD_SIDE, CARD_SIDE, 64);
  ctx.fill();
  ctx.restore();

  drawStyledQr(ctx, input.joinUrl, {
    x: cardX + CARD_PAD,
    y: CARD_TOP + CARD_PAD,
    size: CARD_SIDE - CARD_PAD * 2,
    ink: INK,
    paper: "#ffffff",
  });

  const pillW = 260;
  const pillH = 74;
  const pillY = CARD_TOP + CARD_SIDE - pillH / 2;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect((POSTER_WIDTH - pillW) / 2, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = brand?.onAccent ?? INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 34px ${FONT}`;
  setSpacing(ctx, 5);
  ctx.fillText("SCAN ME", POSTER_WIDTH / 2, pillY + pillH / 2 + 2);
  setSpacing(ctx, 0);

  const stepsTop = pillY + pillH + 56;
  const colW = (POSTER_WIDTH - PAD * 2) / STEPS.length;
  STEPS.forEach((label, i) => {
    const cx = PAD + colW * i + colW / 2;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, stepsTop + 30, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = brand?.onAccent ?? INK;
    ctx.textBaseline = "middle";
    ctx.font = `900 32px ${FONT}`;
    ctx.fillText(String(i + 1), cx, stepsTop + 32);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 27px ${FONT}`;
    wrapLines(ctx, label, colW - 24, 1).forEach((l) => ctx.fillText(l, cx, stepsTop + 98));
  });

  ctx.fillStyle = MUTED;
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 26px ${FONT}`;
  setSpacing(ctx, 3);
  ctx.fillText("POWERED BY GYMDESK", POSTER_WIDTH / 2, POSTER_HEIGHT - 52);
  setSpacing(ctx, 0);
}

/** The poster as a PNG file, for download or sharing. */
export async function buildQrPoster(input: QrPosterInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await drawQrPoster(canvas, input);
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
