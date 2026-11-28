/* A small styled QR (round dots, rounded eyes) for places that show just the code. */
import { useEffect, useRef } from "react";
import { drawStyledQr } from "../../lib/styledQr.ts";

const INK = "#0e0e10";

export function StyledQr({ text, size = 220, label }: { text: string; size?: number; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const scale = window.devicePixelRatio || 1;
    el.width = size * scale;
    el.height = size * scale;
    ctx.scale(scale, scale);
    drawStyledQr(ctx, text, { x: 0, y: 0, size, ink: INK, paper: "#ffffff" });
  }, [text, size]);
  return <canvas ref={canvas} role="img" aria-label={label} style={{ width: size, height: size, maxWidth: "100%", borderRadius: 20, background: "#fff", border: "1px solid var(--border)" }} />;
}
