/**
 * Mulberry32 — a fast, deterministic 32-bit PRNG suitable for reproducible simulations.
 *
 * Using a deterministic seed (e.g. based on iteration index) guarantees that for any
 * given attrition rate the same subjects will be flagged as dropped across multiple runs,
 * making Monte Carlo attrition simulations perfectly reproducible.
 *
 * @param seed - 32-bit unsigned integer seed value.
 * @returns A generator function that yields uniformly distributed floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
