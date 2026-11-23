// Makes a VAPID key pair for web push. Usage: node scripts/gen-vapid.mjs <out.json>
// The private key goes into a wrangler secret (VAPID_PRIVATE_JWK) and .dev.vars, never into git.
import { writeFileSync } from "node:fs";

const out = process.argv[2];
if (!out) {
  console.error("Usage: node scripts/gen-vapid.mjs <out.json>");
  process.exit(1);
}
const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
const publicKey = Buffer.from(raw).toString("base64url");
const privateJwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
writeFileSync(out, JSON.stringify({ publicKey, privateJwk: JSON.stringify(privateJwk) }), { mode: 0o600 });
console.log(`Public key: ${publicKey}`);
