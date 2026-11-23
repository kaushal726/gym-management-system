// Fails if the Pages config and the Worker config disagree on [vars] or the D1 database, so the site and the
// cron always run with the same settings. Run by `npm run deploy`.
import { readFileSync } from "node:fs";

function read(file) {
  const text = readFileSync(file, "utf8");
  const vars = {};
  const section = text.split(/^\[vars\]$/m)[1]?.split(/^\[/m)[0] ?? "";
  for (const line of section.split("\n")) {
    const m = line.match(/^([A-Z_]+)\s*=\s*"(.*)"/);
    if (m) vars[m[1]] = m[2];
  }
  const db = text.match(/database_id\s*=\s*"([^"]+)"/)?.[1];
  return { vars, db };
}

const worker = read("wrangler.toml");
const pages = read("pages/wrangler.toml");
const problems = [];
if (worker.db !== pages.db) problems.push(`D1 database differs: ${worker.db} vs ${pages.db}`);
for (const key of new Set([...Object.keys(worker.vars), ...Object.keys(pages.vars)])) {
  if (worker.vars[key] !== pages.vars[key]) problems.push(`${key} differs`);
}
if (problems.length) {
  console.error(`Config mismatch between wrangler.toml and pages/wrangler.toml:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("Worker and Pages configs match.");
