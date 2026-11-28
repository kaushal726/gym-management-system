/* Draws a QR code in a modern style instead of the plain black squares: round dots, rounded "eyes" in the corners
 * all in one dark colour. Round dots and a full quiet zone keep it easy for any phone camera to read.
 * Pure canvas drawing, nothing is fetched. */
import QRCode from "qrcode";

export interface StyledQrOptions {
  /** Top-left corner and side of the whole code, quiet zone included. */
  x: number;
  y: number;
  size: number;
  /** The dots and eyes. Keep it dark: a light colour makes the code hard to scan. */
  ink: string;
  /** What the code sits on. */
  paper: string;
}

/** Empty modules around the code, as every scanner expects. */
const QUIET_MODULES = 2;
/** The finder "eye" is 7 modules wide in every QR code. */
const EYE_MODULES = 7;
const DOT_RADIUS = 0.47;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ink: string, paper: string) {
  ctx.fillStyle = ink;
  roundedRect(ctx, x, y, EYE_MODULES * cell, EYE_MODULES * cell, cell * 2.4);
  ctx.fill();
  ctx.fillStyle = paper;
  roundedRect(ctx, x + cell, y + cell, (EYE_MODULES - 2) * cell, (EYE_MODULES - 2) * cell, cell * 1.7);
  ctx.fill();
  ctx.fillStyle = ink;
  roundedRect(ctx, x + cell * 2, y + cell * 2, (EYE_MODULES - 4) * cell, (EYE_MODULES - 4) * cell, cell * 1.1);
  ctx.fill();
}

export function drawStyledQr(ctx: CanvasRenderingContext2D, text: string, o: StyledQrOptions): void {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const cell = o.size / (n + QUIET_MODULES * 2);
  const left = o.x + QUIET_MODULES * cell;
  const top = o.y + QUIET_MODULES * cell;

  ctx.fillStyle = o.paper;
  ctx.fillRect(o.x, o.y, o.size, o.size);

  const inEye = (row: number, col: number) => (row < EYE_MODULES && (col < EYE_MODULES || col >= n - EYE_MODULES)) || (row >= n - EYE_MODULES && col < EYE_MODULES);

  ctx.fillStyle = o.ink;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!modules.get(row, col) || inEye(row, col)) continue;
      const cx = left + (col + 0.5) * cell;
      const cy = top + (row + 0.5) * cell;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEye(ctx, left, top, cell, o.ink, o.paper);
  drawEye(ctx, left + (n - EYE_MODULES) * cell, top, cell, o.ink, o.paper);
  drawEye(ctx, left, top + (n - EYE_MODULES) * cell, cell, o.ink, o.paper);
}
