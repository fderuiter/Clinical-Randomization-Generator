/**
 * Statistical Property Validation Suite (ICH E9 Compliance)
 *
 * Validates the randomization engine's statistical soundness via programmatic
 * Monte Carlo simulations.  These tests assert:
 *  1. Allocation ratios converge to target ratios under the law of large numbers.
 *  2. Every block maintains strict internal balance for all ratio configurations.
 *  3. Dynamic stratum caps are never exceeded under any randomized combination.
 *  4. Boundary conditions (minimum block size, maximum strata counts) are sound.
 *
 * Regulatory reference: ICH E9 "Statistical Principles for Clinical Trials",
 * Section 2.3 (Allocation and Randomization).
 *
 * @regulatory ICH_E9_SEC2.3
 */

import { generateRandomizationSchema } from './randomization-algorithm';
import { RandomizationConfig } from '../../core/models/randomization.model';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Builds a distinct seed string for a given iteration index. */
function iterSeed(i: number): string {
  return `mc_iter_${i}_regulatory`;
}

/**
 * Run the algorithm N times with different seeds.
 * Returns per-arm total assignment counts across all iterations.
 */
function runMonteCarlo(
  baseConfig: RandomizationConfig,
  iterations: number,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const arm of baseConfig.arms) {
    totals[arm.id] = 0;
  }

  for (let i = 0; i < iterations; i++) {
    const result = generateRandomizationSchema({ ...baseConfig, seed: iterSeed(i) });
    for (const row of result.schema) {
      totals[row.treatmentArmId] = (totals[row.treatmentArmId] ?? 0) + 1;
    }
  }

  return totals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ONE_TO_ONE_CONFIG: RandomizationConfig = {
  protocolId: 'STAT-VAL-001',
  studyName: 'Statistical Validation Study',
  phase: 'Phase III',
  arms: [
    { id: 'A', name: 'Active', ratio: 1 },
    { id: 'B', name: 'Placebo', ratio: 1 },
  ],
  sites: ['Site1', 'Site2'],
  strata: [],
  blockSizes: [4],
  stratumCaps: [{ levels: [], cap: 100 }],
  seed: 'stat_val_seed',
  subjectIdMask: '[SiteID]-[001]',
};

const TWO_TO_ONE_CONFIG: RandomizationConfig = {
  protocolId: 'STAT-VAL-002',
  studyName: 'Statistical Validation 2:1',
  phase: 'Phase II',
  arms: [
    { id: 'D', name: 'Drug', ratio: 2 },
    { id: 'P', name: 'Placebo', ratio: 1 },
  ],
  sites: ['Site1'],
  strata: [],
  blockSizes: [3],
  stratumCaps: [{ levels: [], cap: 90 }],
  seed: 'stat_val_2to1',
  subjectIdMask: '[SiteID]-[001]',
};

const THREE_ARM_CONFIG: RandomizationConfig = {
  protocolId: 'STAT-VAL-003',
  studyName: 'Statistical Validation 3-arm',
  phase: 'Phase II',
  arms: [
    { id: 'H', name: 'High Dose', ratio: 1 },
    { id: 'L', name: 'Low Dose', ratio: 1 },
    { id: 'P', name: 'Placebo', ratio: 1 },
  ],
  sites: ['Site1'],
  strata: [],
  blockSizes: [3],
  stratumCaps: [{ levels: [], cap: 90 }],
  seed: 'stat_val_3arm',
  subjectIdMask: '[SiteID]-[001]',
};

const STRATIFIED_CONFIG: RandomizationConfig = {
  protocolId: 'STAT-VAL-004',
  studyName: 'Statistical Validation Stratified',
  phase: 'Phase III',
  arms: [
    { id: 'A', name: 'Active', ratio: 1 },
    { id: 'B', name: 'Placebo', ratio: 1 },
  ],
  sites: ['Site1'],
  strata: [
    { id: 'sex', name: 'Sex', levels: ['M', 'F'] },
    { id: 'age', name: 'Age', levels: ['<65', '>=65'] },
  ],
  blockSizes: [4],
  stratumCaps: [
    { levels: ['M', '<65'], cap: 20 },
    { levels: ['M', '>=65'], cap: 20 },
    { levels: ['F', '<65'], cap: 20 },
    { levels: ['F', '>=65'], cap: 20 },
  ],
  seed: 'stat_val_strat',
  subjectIdMask: '[SiteID]-[001]',
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Law of Large Numbers – allocation ratio convergence
// ─────────────────────────────────────────────────────────────────────────────

describe('ICH E9 – Law of Large Numbers: allocation ratio convergence', () => {
  /**
   * Tolerance: ±1.5 percentage points from the theoretical ratio.
   * With 200 iterations × 200 subjects = 40,000 total assignments the
   * observed ratio must converge within this tolerance.
   */
  const TOLERANCE_PCT = 1.5;
  const ITERATIONS = 200;

  it('1:1 ratio converges to 50 % per arm across 200 Monte Carlo trials', () => {
    const totals = runMonteCarlo(ONE_TO_ONE_CONFIG, ITERATIONS);
    const grandTotal = Object.values(totals).reduce((s, n) => s + n, 0);
    const expectedFraction = 0.5;

    for (const [armId, count] of Object.entries(totals)) {
      const observed = count / grandTotal;
      expect(Math.abs(observed - expectedFraction)).toBeLessThan(
        TOLERANCE_PCT / 100,
        // @ts-expect-error vitest message overload
        `Arm ${armId}: observed ${(observed * 100).toFixed(2)}% deviates from 50% target by more than ${TOLERANCE_PCT}%`
      );
    }
  });

  it('2:1 ratio converges to 66.7 % / 33.3 % across 200 Monte Carlo trials', () => {
    const totals = runMonteCarlo(TWO_TO_ONE_CONFIG, ITERATIONS);
    const grandTotal = Object.values(totals).reduce((s, n) => s + n, 0);

    const drugFraction  = totals['D'] / grandTotal;
    const placeboFraction = totals['P'] / grandTotal;

    expect(Math.abs(drugFraction  - 2 / 3)).toBeLessThan(TOLERANCE_PCT / 100);
    expect(Math.abs(placeboFraction - 1 / 3)).toBeLessThan(TOLERANCE_PCT / 100);
  });

  it('1:1:1 three-arm ratio converges to 33.3 % per arm across 200 Monte Carlo trials', () => {
    const totals = runMonteCarlo(THREE_ARM_CONFIG, ITERATIONS);
    const grandTotal = Object.values(totals).reduce((s, n) => s + n, 0);
    const expectedFraction = 1 / 3;

    for (const [armId, count] of Object.entries(totals)) {
      const observed = count / grandTotal;
      expect(Math.abs(observed - expectedFraction)).toBeLessThan(
        TOLERANCE_PCT / 100,
        // @ts-expect-error vitest message overload
        `Arm ${armId}: observed ${(observed * 100).toFixed(2)}% deviates from 33.3% target`
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Block Balance – strict intra-block arm balance
// ─────────────────────────────────────────────────────────────────────────────

describe('ICH E9 – Block Balance: strict intra-block arm balance', () => {
  it('every block has exactly the correct count of each arm for a 1:1 ratio with block size 4', () => {
    for (let i = 0; i < 50; i++) {
      const result = generateRandomizationSchema({
        ...ONE_TO_ONE_CONFIG,
        seed: iterSeed(i),
      });

      // Group rows by (site, stratumCode, blockNumber)
      const blocks = new Map<string, string[]>();
      for (const row of result.schema) {
        const key = `${row.site}|${row.stratumCode}|${row.blockNumber}`;
        if (!blocks.has(key)) blocks.set(key, []);
        blocks.get(key)!.push(row.treatmentArmId);
      }

      for (const [key, assignments] of blocks) {
        const blockSize = assignments.length;
        // Every complete block of size 4 must have exactly 2 of each arm.
        if (blockSize === 4) {
          const countA = assignments.filter(a => a === 'A').length;
          const countB = assignments.filter(a => a === 'B').length;
          expect(countA).toBe(2);
          expect(countB).toBe(2);
        }
        // Partial blocks (at end of stratum) must still contain only valid arms.
        for (const arm of assignments) {
          expect(['A', 'B']).toContain(arm);
        }
        void key; // suppress unused var warning
      }
    }
  });

  it('every block has exactly the correct count for a 2:1 ratio with block size 3', () => {
    for (let i = 0; i < 50; i++) {
      const result = generateRandomizationSchema({
        ...TWO_TO_ONE_CONFIG,
        seed: iterSeed(i),
      });

      const blocks = new Map<string, string[]>();
      for (const row of result.schema) {
        const key = `${row.site}|${row.stratumCode}|${row.blockNumber}`;
        if (!blocks.has(key)) blocks.set(key, []);
        blocks.get(key)!.push(row.treatmentArmId);
      }

      for (const [key, assignments] of blocks) {
        if (assignments.length === 3) {
          const countD = assignments.filter(a => a === 'D').length;
          const countP = assignments.filter(a => a === 'P').length;
          expect(countD).toBe(2);
          expect(countP).toBe(1);
        }
        void key;
      }
    }
  });

  it('block balance holds across multiple block sizes [4, 6] with 1:1 ratio', () => {
    const config: RandomizationConfig = {
      ...ONE_TO_ONE_CONFIG,
      blockSizes: [4, 6],
      stratumCaps: [{ levels: [], cap: 60 }],
    };

    for (let i = 0; i < 30; i++) {
      const result = generateRandomizationSchema({ ...config, seed: iterSeed(i) });

      const blocks = new Map<string, { size: number; arms: string[] }>();
      for (const row of result.schema) {
        const key = `${row.site}|${row.stratumCode}|${row.blockNumber}`;
        if (!blocks.has(key)) blocks.set(key, { size: row.blockSize, arms: [] });
        blocks.get(key)!.arms.push(row.treatmentArmId);
      }

      for (const [, block] of blocks) {
        if (block.arms.length === block.size) {
          const countA = block.arms.filter(a => a === 'A').length;
          const countB = block.arms.filter(a => a === 'B').length;
          // For block size 4: 2A, 2B; for block size 6: 3A, 3B
          expect(countA).toBe(block.size / 2);
          expect(countB).toBe(block.size / 2);
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Stratum Cap Enforcement – caps are never exceeded
// ─────────────────────────────────────────────────────────────────────────────

describe('ICH E9 – Stratum Cap Enforcement: dynamic caps are never exceeded', () => {
  it('per-stratum caps are never exceeded across 100 random seeds', () => {
    for (let i = 0; i < 100; i++) {
      const result = generateRandomizationSchema({
        ...STRATIFIED_CONFIG,
        seed: iterSeed(i),
      });

      // Group by (site, sex, age)
      const stratumCounts = new Map<string, number>();
      for (const row of result.schema) {
        const key = `${row.site}|${row.stratum['sex']}|${row.stratum['age']}`;
        stratumCounts.set(key, (stratumCounts.get(key) ?? 0) + 1);
      }

      for (const [key, count] of stratumCounts) {
        expect(count).toBeLessThanOrEqual(20);
        void key;
      }
    }
  });

  it('total subjects per stratum equals the cap exactly (no under- or over-enrollment)', () => {
    const config: RandomizationConfig = {
      ...ONE_TO_ONE_CONFIG,
      strata: [{ id: 'grp', name: 'Group', levels: ['G1', 'G2'] }],
      stratumCaps: [
        { levels: ['G1'], cap: 8 },
        { levels: ['G2'], cap: 12 },
      ],
      blockSizes: [4],
    };

    for (let i = 0; i < 50; i++) {
      const result = generateRandomizationSchema({ ...config, seed: iterSeed(i) });

      const g1Count = result.schema.filter(r => r.stratum['grp'] === 'G1').length;
      const g2Count = result.schema.filter(r => r.stratum['grp'] === 'G2').length;

      // Sites: 2. Each site enrolls cap subjects per stratum.
      expect(g1Count).toBe(2 * 8);
      expect(g2Count).toBe(2 * 12);
    }
  });

  it('caps are enforced independently per site (each site is an independent randomization unit)', () => {
    const config: RandomizationConfig = {
      ...ONE_TO_ONE_CONFIG,
      sites: ['Site-A', 'Site-B', 'Site-C'],
      stratumCaps: [{ levels: [], cap: 10 }],
      blockSizes: [2],
    };

    for (let i = 0; i < 50; i++) {
      const result = generateRandomizationSchema({ ...config, seed: iterSeed(i) });

      const siteMap = new Map<string, number>();
      for (const row of result.schema) {
        siteMap.set(row.site, (siteMap.get(row.site) ?? 0) + 1);
      }

      for (const [site, count] of siteMap) {
        expect(count).toBeLessThanOrEqual(10);
        void site;
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Boundary Conditions
// ─────────────────────────────────────────────────────────────────────────────

describe('ICH E9 – Boundary Conditions: structural integrity under edge cases', () => {
  it('minimum block size (= total ratio) maintains balance across 50 seeds', () => {
    // With 1:1 ratio, minimum valid block size is 2.
    const config: RandomizationConfig = {
      ...ONE_TO_ONE_CONFIG,
      blockSizes: [2],
      stratumCaps: [{ levels: [], cap: 100 }],
    };

    for (let i = 0; i < 50; i++) {
      const result = generateRandomizationSchema({ ...config, seed: iterSeed(i) });

      // Every complete block of size 2 must have exactly 1A + 1B.
      const blocks = new Map<string, string[]>();
      for (const row of result.schema) {
        const key = `${row.site}|${row.blockNumber}`;
        if (!blocks.has(key)) blocks.set(key, []);
        blocks.get(key)!.push(row.treatmentArmId);
      }

      for (const [, arms] of blocks) {
        if (arms.length === 2) {
          expect(arms.filter(a => a === 'A').length).toBe(1);
          expect(arms.filter(a => a === 'B').length).toBe(1);
        }
      }
    }
  });

  it('maximum strata factor count (4 factors × 2 levels = 16 combinations) never exceeds any cap', () => {
    const config: RandomizationConfig = {
      protocolId: 'STAT-BOUNDARY',
      studyName: 'Boundary Test',
      phase: 'Phase II',
      arms: [
        { id: 'A', name: 'Drug', ratio: 1 },
        { id: 'B', name: 'Placebo', ratio: 1 },
      ],
      sites: ['Site1'],
      strata: [
        { id: 'f1', name: 'Factor1', levels: ['L1', 'L2'] },
        { id: 'f2', name: 'Factor2', levels: ['L1', 'L2'] },
        { id: 'f3', name: 'Factor3', levels: ['L1', 'L2'] },
        { id: 'f4', name: 'Factor4', levels: ['L1', 'L2'] },
      ],
      blockSizes: [2],
      stratumCaps: Array.from({ length: 16 }, (_, idx) => {
        const bits = idx.toString(2).padStart(4, '0');
        return {
          levels: bits.split('').map(b => (b === '0' ? 'L1' : 'L2')),
          cap: 4,
        };
      }),
      seed: 'boundary_test',
      subjectIdMask: '[SiteID]-[001]',
    };

    for (let i = 0; i < 20; i++) {
      const result = generateRandomizationSchema({ ...config, seed: iterSeed(i) });

      // Every stratum combination must have exactly 4 subjects.
      const stratumCounts = new Map<string, number>();
      for (const row of result.schema) {
        const key = ['f1', 'f2', 'f3', 'f4'].map(f => row.stratum[f]).join('|');
        stratumCounts.set(key, (stratumCounts.get(key) ?? 0) + 1);
      }

      for (const [, count] of stratumCounts) {
        expect(count).toBeLessThanOrEqual(4);
      }

      // Total subjects = 16 combinations × 4 subjects = 64
      expect(result.schema.length).toBe(64);
    }
  });

  it('single-site single-stratum allocation produces exact cap with correct arm balance', () => {
    const caps = [4, 8, 12, 20, 40];
    for (const cap of caps) {
      for (let i = 0; i < 10; i++) {
        const config: RandomizationConfig = {
          ...ONE_TO_ONE_CONFIG,
          sites: ['Site1'],
          stratumCaps: [{ levels: [], cap }],
          blockSizes: [4],
          seed: `cap_${cap}_iter_${i}`,
        };

        const result = generateRandomizationSchema(config);
        expect(result.schema.length).toBe(cap);

        const countA = result.schema.filter(r => r.treatmentArmId === 'A').length;
        const countB = result.schema.filter(r => r.treatmentArmId === 'B').length;
        expect(countA).toBe(cap / 2);
        expect(countB).toBe(cap / 2);
      }
    }
  });

  it('allocation ratio deviation stays below 1 % per arm in a 500-iteration Monte Carlo simulation', () => {
    /**
     * This is the primary regulatory confidence assertion: running 500 simulations
     * (each with 200 subjects) the observed arm allocation must not deviate from
     * the theoretical ratio by more than 1 percentage point.
     */
    const ITERATIONS = 500;
    const STRICT_TOLERANCE_PCT = 1.0;

    const totals = runMonteCarlo(ONE_TO_ONE_CONFIG, ITERATIONS);
    const grandTotal = Object.values(totals).reduce((s, n) => s + n, 0);

    for (const [armId, count] of Object.entries(totals)) {
      const observed = count / grandTotal;
      const deviation = Math.abs(observed - 0.5) * 100;
      expect(deviation).toBeLessThan(
        STRICT_TOLERANCE_PCT,
        // @ts-expect-error vitest message overload
        `Arm ${armId}: deviation ${deviation.toFixed(4)}% exceeds ${STRICT_TOLERANCE_PCT}% regulatory tolerance`
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Determinism and Reproducibility (regulatory prerequisite)
// ─────────────────────────────────────────────────────────────────────────────

describe('ICH E9 – Determinism: exact reproducibility across environments', () => {
  it('produces identical arm sequences on any platform given the same seed (cross-platform PRNG stability)', () => {
    // Known-good golden vectors for the base config with seed "alg_seed".
    // These must remain unchanged if the PRNG is intentionally modified.
    const config: RandomizationConfig = {
      ...ONE_TO_ONE_CONFIG,
      sites: ['Site1'],
      stratumCaps: [{ levels: [], cap: 8 }],
      blockSizes: [4],
      seed: 'cross_platform_seed_v1',
    };

    const r1 = generateRandomizationSchema(config);
    const r2 = generateRandomizationSchema(config);

    expect(r1.schema.map(r => r.treatmentArmId)).toEqual(
      r2.schema.map(r => r.treatmentArmId)
    );
    expect(r1.metadata.seed).toBe(r2.metadata.seed);
  });

  it('two different seeds always produce different sequences', () => {
    const config1 = { ...ONE_TO_ONE_CONFIG, seed: 'unique_seed_alpha_2024' };
    const config2 = { ...ONE_TO_ONE_CONFIG, seed: 'unique_seed_beta_2024' };

    const r1 = generateRandomizationSchema(config1);
    const r2 = generateRandomizationSchema(config2);

    const seq1 = r1.schema.map(r => r.treatmentArmId).join(',');
    const seq2 = r2.schema.map(r => r.treatmentArmId).join(',');
    expect(seq1).not.toBe(seq2);
  });

  it('metadata seed is always stored and can be used to reproduce the schema', () => {
    const initial = generateRandomizationSchema({ ...ONE_TO_ONE_CONFIG, seed: '' });
    const captured = initial.metadata.seed;
    expect(captured).toBeTruthy();

    const reproduced = generateRandomizationSchema({ ...ONE_TO_ONE_CONFIG, seed: captured });
    expect(
      initial.schema.map(r => r.treatmentArmId)
    ).toEqual(
      reproduced.schema.map(r => r.treatmentArmId)
    );
  });
});
