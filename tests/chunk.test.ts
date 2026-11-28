import { describe, expect, it } from "vitest";
import { chunk, MAX_BOUND_VALUES } from "../worker/src/lib/chunk.ts";
import { pushTargets } from "../worker/src/push/notify.ts";

/** D1 refuses a statement with more than this many bound values. */
const D1_LIMIT = 100;

describe("chunk", () => {
  it("splits at every size without losing, repeating or reordering anything", () => {
    for (let length = 0; length <= 260; length++) {
      const items = Array.from({ length }, (_, i) => i);
      for (const size of [1, 2, 7, 90, 100, 300]) {
        const pieces = chunk(items, size);
        expect(pieces.flat()).toEqual(items);
        for (const piece of pieces) {
          expect(piece.length).toBeGreaterThan(0);
          expect(piece.length).toBeLessThanOrEqual(size);
        }
      }
    }
  });

  it("refuses a size that would never finish", () => {
    for (const size of [0, -1, 1.5, Number.NaN]) expect(() => chunk([1, 2, 3], size)).toThrow(RangeError);
  });

  it("keeps the default under D1's limit", () => {
    expect(MAX_BOUND_VALUES).toBeLessThan(D1_LIMIT);
  });
});

describe("pushTargets", () => {
  /** A fake D1 that rejects any statement with too many bound values, like the real one, and has a device per user. */
  function fakeDb() {
    const bindCounts: number[] = [];
    const db = {
      prepare() {
        return {
          bind(...values: unknown[]) {
            bindCounts.push(values.length);
            if (values.length > D1_LIMIT) throw new Error(`variable number must be between ?1 and ?${D1_LIMIT}`);
            return { values };
          },
        };
      },
      async batch(statements: { values: string[] }[]) {
        return statements.map((s) => ({ results: s.values.map((user_id) => ({ user_id, endpoint: `https://push.example/${user_id}`, p256dh: "k", auth: "a" })) }));
      },
    };
    return { db: db as unknown as D1Database, bindCounts };
  }

  it("finds the devices of any number of users, never binding more than D1 allows", async () => {
    for (const count of [0, 1, 89, 90, 91, 100, 101, 199, 200, 450]) {
      const { db, bindCounts } = fakeDb();
      const users = Array.from({ length: count }, (_, i) => `user-${i}`);
      const targets = await pushTargets(db, users);
      expect(targets.map((t) => t.user_id)).toEqual(users);
      for (const n of bindCounts) expect(n).toBeLessThanOrEqual(D1_LIMIT);
    }
  });
});
