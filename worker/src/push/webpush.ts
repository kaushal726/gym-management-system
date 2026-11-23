/* Web Push with an encrypted payload (RFC 8291, aes128gcm) and VAPID (RFC 8292), using only WebCrypto.
 * Free: the browser's own push service delivers it, no third party involved. */
import { base64url, fromBase64url } from "../lib/crypto.ts";

const encoder = new TextEncoder();
const RECORD_SIZE = 4096;
const JWT_HOURS = 12;
/** A reminder nobody's phone picks up within a day is dropped rather than delivered late. */
const PUSH_TTL_SECONDS = 86_400;

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidKeys {
  publicKey: string;
  privateJwk: string;
  subject: string;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

/** Encrypts a payload for one browser subscription. `serverKeys`/`salt` can be fixed for tests. */
export async function encryptPayload(
  target: Pick<PushTarget, "p256dh" | "auth">,
  plaintext: Uint8Array,
  serverKeys?: CryptoKeyPair,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)),
): Promise<Uint8Array> {
  const uaPublic = fromBase64url(target.p256dh);
  const authSecret = fromBase64url(target.auth);
  const keys = serverKeys ?? ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdhParams(uaKey), keys.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const record = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, record));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

/** The standard ECDH parameter is `public`; workers-types spells it `$public` (a binding quirk), the runtime reads `public`. */
function ecdhParams(publicKey: CryptoKey): SubtleCryptoDeriveKeyAlgorithm {
  return { name: "ECDH", public: publicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
}

let cachedSigningKey: { jwk: string; key: CryptoKey } | null = null;

async function vapidAuthorization(endpoint: string, vapid: VapidKeys): Promise<string> {
  if (cachedSigningKey?.jwk !== vapid.privateJwk) {
    const key = await crypto.subtle.importKey("jwk", JSON.parse(vapid.privateJwk), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    cachedSigningKey = { jwk: vapid.privateJwk, key };
  }
  const header = base64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + JWT_HOURS * 3600, sub: vapid.subject };
  const payload = base64url(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cachedSigningKey.key, encoder.encode(`${header}.${payload}`));
  return `vapid t=${header}.${payload}.${base64url(signature)}, k=${vapid.publicKey}`;
}

export type PushOutcome = "sent" | "gone" | "failed";

export async function sendPush(target: PushTarget, message: PushMessage, vapid: VapidKeys): Promise<PushOutcome> {
  try {
    const body = await encryptPayload(target, encoder.encode(JSON.stringify(message)));
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        TTL: String(PUSH_TTL_SECONDS),
        Urgency: "normal",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Authorization: await vapidAuthorization(target.endpoint, vapid),
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "failed";
  } catch (err) {
    console.warn("Push failed", err);
    return "failed";
  }
}
