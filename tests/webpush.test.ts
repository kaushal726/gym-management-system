import { describe, expect, it } from "vitest";
import { encryptPayload } from "../worker/src/push/webpush.ts";
import { base64url, fromBase64url } from "../worker/src/lib/crypto.ts";
import { toCsv } from "../worker/src/lib/csv.ts";

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

const enc = new TextEncoder();

/** Decrypts the way a browser does (RFC 8291), so the test proves a real browser could read our payload. */
async function browserDecrypt(body: Uint8Array, uaKeys: CryptoKeyPair, uaPublicRaw: Uint8Array, auth: Uint8Array) {
  const salt = body.slice(0, 16);
  const idLen = body[20];
  const asPublic = body.slice(21, 21 + idLen);
  const ciphertext = body.slice(21 + idLen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, uaKeys.privateKey, 256));
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublicRaw, ...asPublic]);
  const ikm = await hkdf(auth, shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext));
  expect(plain[plain.length - 1]).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe("web push payload encryption", () => {
  it("produces a payload a browser can decrypt", async () => {
    const uaKeys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const uaPublicRaw = new Uint8Array((await crypto.subtle.exportKey("raw", uaKeys.publicKey)) as ArrayBuffer);
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const message = JSON.stringify({ title: "Membership ends tomorrow", body: "Hi Ravi, renew at the desk today.", url: "/me" });
    const body = await encryptPayload({ p256dh: base64url(uaPublicRaw), auth: base64url(auth) }, enc.encode(message));
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(await browserDecrypt(body, uaKeys, uaPublicRaw, auth)).toBe(message);
  });

  it("round-trips base64url", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(65));
    expect([...fromBase64url(base64url(bytes))]).toEqual([...bytes]);
  });
});

describe("csv export", () => {
  it("quotes cells, keeps refunds numeric and defuses formulas", () => {
    const csv = toCsv(["Name", "Amount"], [["=HYPERLINK(\"x\")", "-500.00"], ['Ravi "Bhai"', "1500.00"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")","-500.00"`);
    expect(csv).toContain(`"Ravi ""Bhai""","1500.00"`);
  });
});
