import { StratificationFactor, StratumCap } from '../../core/models/randomization.model';

/**
 * Validates that every stratification factor's level percentages sum to exactly 100.
 * Returns an object mapping factorId → true if invalid.
 */
export function validateProportionalPercentages(
  strata: StratificationFactor[],
  percentages: Record<string, Record<string, number>>
): Record<string, boolean> {
  const invalid: Record<string, boolean> = {};
  for (const factor of strata) {
    const factorPercentages = percentages[factor.id] ?? {};
    const total = factor.levels.reduce((sum, level) => sum + (factorPercentages[level] ?? 0), 0);
    if (Math.abs(total - 100) > 0.001) {
      invalid[factor.id] = true;
    }
  }
  return invalid;
}

/**
 * Generates the Cartesian product of all strata level combinations.
 * Returns an array of level-name arrays, one entry per combination.
 */
function generateIntersections(strata: StratificationFactor[]): string[][] {
  if (strata.length === 0) return [[]];
  return strata.reduce<string[][]>(
    (acc, factor) => {
      const result: string[][] = [];
      for (const combo of acc) {
        for (const level of factor.levels) {
          result.push([...combo, level]);
        }
      }
      return result;
    },
    [[]]
  );
}

/**
 * Computes per-intersection enrollment caps using the **Largest Remainder Method** (Hare–Niemeyer).
 *
 * When `globalCap` is a positive integer and each stratification factor's level percentages
 * sum to exactly 100, the algorithm guarantees that the sum of all returned caps equals
 * exactly `globalCap`, eliminating rounding errors that arise from naively rounding each
 * fractional value.
 *
 * For invalid inputs (for example, a non-integer `globalCap` or factor percentages that do
 * not sum to 100), the function still returns caps for every intersection, but the returned
 * caps are not guaranteed to sum exactly to `globalCap`. `remainingSeats` is clamped to
 * `[0, intersections]` to guard against out-of-bounds allocation when percentages are invalid.
 *
 * @param strata - The stratification factors with their levels.
 * @param globalCap - Total enrollment target. Should be a positive integer for the exact-sum guarantee.
 * @param percentages - Mapping of factorId → (levelName → percentage, 0–100).
 *   Each factor's level percentages should sum to 100 for the exact-sum guarantee.
 * @returns An array of { levels, cap } objects covering every intersection. The caps sum to
 *   `globalCap` only when the input preconditions above are satisfied.
 */
export function computeProportionalCaps(
  strata: StratificationFactor[],
  globalCap: number,
  percentages: Record<string, Record<string, number>>
): StratumCap[] {
  const combinations = generateIntersections(strata);

  // Step 1: Compute the theoretical (real-valued) target for each intersection.
  const entries = combinations.map(combo => {
    const probability = strata.reduce((prod, factor, idx) => {
      const levelName = combo[idx];
      const pct = percentages[factor.id]?.[levelName] ?? 0;
      return prod * (pct / 100);
    }, 1);

    const theoreticalValue = probability * globalCap;
    const floored = Math.floor(theoreticalValue);
    const remainder = theoreticalValue - floored;
    return { levels: combo, theoreticalValue, floored, remainder, finalCap: floored };
  });

  // Step 2: Distribute remaining seats to the intersections with the largest remainders.
  const totalFloored = entries.reduce((s, e) => s + e.floored, 0);
  // globalCap should be a positive integer; Math.floor guards against any floating-point drift.
  // Clamp to [0, entries.length]: the for-loop below accesses sortedIndices[0..remainingSeats-1]
  // and sortedIndices.length === entries.length, so entries.length is the safe upper bound.
  // This also guards against invalid percentage inputs that don't sum to 100%.
  const rawRemaining = Math.floor(globalCap - totalFloored);
  const remainingSeats = Math.max(0, Math.min(rawRemaining, entries.length));

  // Sort by remainder descending (stable: tie-break by original index for determinism).
  const sortedIndices = entries
    .map((e, i) => ({ remainder: e.remainder, index: i }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let i = 0; i < remainingSeats; i++) {
    entries[sortedIndices[i].index].finalCap++;
  }

  return entries.map(e => ({ levels: e.levels, cap: e.finalCap }));
}
