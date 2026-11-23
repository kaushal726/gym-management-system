// Renders the PNG icons in web/public from the SVGs with headless Chrome. Run after changing an SVG:
//   node scripts/render-icons.mjs   (set CHROME if the browser is not at the usual macOS path)
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUBLIC = resolve(import.meta.dirname, "../web/public");
const SRC = {
  rounded: join(PUBLIC, "icon.svg"),
  full: join(import.meta.dirname, "icon-full.svg"),
  badge: join(import.meta.dirname, "badge.svg"),
};
// Launchers, iOS and maskable icons cut their own shape, so they get the full-bleed square.
const TARGETS = [
  { file: "icon-192.png", src: "rounded", size: 192 },
  { file: "icon-512.png", src: "rounded", size: 512 },
  { file: "icon-maskable-512.png", src: "full", size: 512 },
  { file: "apple-touch-icon.png", src: "full", size: 180 },
  { file: "badge-96.png", src: "badge", size: 96 },
];

const work = mkdtempSync(join(tmpdir(), "gymdesk-icons-"));
try {
  for (const t of TARGETS) {
    const html = join(work, `${t.file}.html`);
    writeFileSync(html, `<!doctype html><body style="margin:0;background:transparent"><img src="${pathToFileURL(SRC[t.src]).href}" width="${t.size}" height="${t.size}" style="display:block">`);
    execFileSync(CHROME, ["--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--default-background-color=00000000", `--window-size=${t.size},${t.size}`, `--screenshot=${join(PUBLIC, t.file)}`, pathToFileURL(html).href], { stdio: "ignore" });
    console.log(`${t.file} (${t.size}px)`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
