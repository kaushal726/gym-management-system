/* D1 allows at most 100 bound values in one statement, so a long list goes into an IN (...) in pieces. */

/** The most values bound into one statement. D1's limit is 100; this leaves room for a few fixed parameters. */
export const MAX_BOUND_VALUES = 90;

/** Splits a list into pieces of at most `size` items, keeping the order. */
export function chunk<T>(items: readonly T[], size: number = MAX_BOUND_VALUES): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("Chunk size must be a whole number of at least 1.");
  const pieces: T[][] = [];
  for (let i = 0; i < items.length; i += size) pieces.push(items.slice(i, i + size));
  return pieces;
}
