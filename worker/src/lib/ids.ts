/* Sortable random ids (ULID layout): 10 characters of time, 16 of randomness. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newId(now: number = Date.now()): string {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const random = crypto.getRandomValues(new Uint8Array(16));
  let rest = "";
  for (const byte of random) rest += ALPHABET[byte % 32];
  return time + rest;
}

export function nowIso(): string {
  return new Date().toISOString();
}
