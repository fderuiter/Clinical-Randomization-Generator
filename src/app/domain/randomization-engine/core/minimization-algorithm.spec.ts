import { generateRandomizationSchema } from './randomization-algorithm';
import { RandomizationConfig } from '../../core/models/randomization.model';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal config for minimization: 2 arms, 1 stratum factor with 2 levels. */
const BASE_MIN_CONFIG: RandomizationConfig = {
  protocolId: 'MIN-001',
  studyName: 'Minimization Test',
  phase: 'Phase III',
  randomizationMethod: 'MINIMIZATION',
  arms: [
    { id: 'A', name: 'Active', ratio: 1 },
    { id: 'B', name: 'Placebo', ratio: 1 }
  ],
  sites: ['Site1'],
  strata: [
    { id: 'age', name: 'Age Group', levels: ['<65', '>=65'] }
  ],
  blockSizes: [],
  stratumCaps: [],
  seed: 'min_test_seed',
  subjectIdMask: '{SITE}-{SEQ:3}',
  biasedCoinProbability: 0.8,
  targetEnrollment: 20
};

// ─────────────────────────────────────────────────────────────────────────────
// Basic structure
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – MINIMIZATION method', () => {
  describe('basic structure', () => {
    it('returns result with schema and metadata', () => {
      const result = generateRandomizationSchema(BASE_MIN_CONFIG);
      expect(result).toHaveProperty('schema');
      expect(result).toHaveProperty('metadata');
    });

    it('generates exactly targetEnrollment subjects', () => {
      const result = generateRandomizationSchema(BASE_MIN_CONFIG);
      expect(result.schema.length).toBe(BASE_MIN_CONFIG.targetEnrollment);
    });

    it('returns empty schema when targetEnrollment is 0', () => {
      const result = generateRandomizationSchema({ ...BASE_MIN_CONFIG, targetEnrollment: 0 });
      expect(result.schema.length).toBe(0);
    });

    it('returns empty schema when targetEnrollment is undefined', () => {
      const result = generateRandomizationSchema({ ...BASE_MIN_CONFIG, targetEnrollment: undefined });
      expect(result.schema.length).toBe(0);
    });

    it('populates required fields on every schema row', () => {
      const result = generateRandomizationSchema(BASE_MIN_CONFIG);
      for (const row of result.schema) {
        expect(row.subjectId).toBeTruthy();
        expect(row.site).toBeTruthy();
        expect(row.treatmentArm).toBeTruthy();
        expect(row.treatmentArmId).toBeTruthy();
        expect(typeof row.stratum).toBe('object');
      }
    });

    it('sets blockNumber to 0 (no blocks in minimization)', () => {
      const result = generateRandomizationSchema(BASE_MIN_CONFIG);
      for (const row of result.schema) {
        expect(row.blockNumber).toBe(0);
      }
    });

    it('sets blockSize to 0 (no blocks in minimization)', () => {
      const result = generateRandomizationSchema(BASE_MIN_CONFIG);
      for (const row of result.schema) {
        expect(row.blockSize).toBe(0);
      }
    });

    it('stores the randomization method in metadata.config', () => {
      const result = generateRandomizationSchema(BASE_MIN_CONFIG);
      expect(result.metadata.config.randomizationMethod).toBe('MINIMIZATION');
    });

    it('copies biasedCoinProbability into metadata.config', () => {
      const result = generateRandomizationSchema(BASE_MIN_CONFIG);
      expect(result.metadata.config.biasedCoinProbability).toBe(0.8);
    });

    it('assigns a generatedAt ISO timestamp', () => {
      const result = generateRandomizationSchema(BASE_MIN_CONFIG);
      expect(() => new Date(result.metadata.generatedAt)).not.toThrow();
      expect(new Date(result.metadata.generatedAt).getFullYear()).toBeGreaterThan(2020);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Seeding & reproducibility
  // ─────────────────────────────────────────────────────────────────────────

  describe('seeding & reproducibility', () => {
    it('produces identical assignment sequences with the same seed', () => {
      const r1 = generateRandomizationSchema(BASE_MIN_CONFIG);
      const r2 = generateRandomizationSchema(BASE_MIN_CONFIG);
      expect(r1.schema.map(r => r.treatmentArmId)).toEqual(r2.schema.map(r => r.treatmentArmId));
    });

    it('produces different sequences for different seeds', () => {
      const r1 = generateRandomizationSchema(BASE_MIN_CONFIG);
      const r2 = generateRandomizationSchema({ ...BASE_MIN_CONFIG, seed: 'different_seed_xyz' });
      const arms1 = r1.schema.map(r => r.treatmentArmId).join('');
      const arms2 = r2.schema.map(r => r.treatmentArmId).join('');
      expect(arms1).not.toBe(arms2);
    });

    it('auto-generates a non-empty seed when seed is empty string', () => {
      const result = generateRandomizationSchema({ ...BASE_MIN_CONFIG, seed: '' });
      expect(result.metadata.seed).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Balance properties
  // ─────────────────────────────────────────────────────────────────────────

  describe('balance properties', () => {
    it('achieves reasonable overall balance (within ±25%) with p=0.8', () => {
      const config: RandomizationConfig = {
        ...BASE_MIN_CONFIG,
        targetEnrollment: 100,
        seed: 'balance_check_seed'
      };
      const result = generateRandomizationSchema(config);
      const countA = result.schema.filter(r => r.treatmentArmId === 'A').length;
      const countB = result.schema.filter(r => r.treatmentArmId === 'B').length;
      // With minimization, balance should be tighter than pure random
      expect(Math.abs(countA - countB)).toBeLessThanOrEqual(25);
    });

    it('achieves near-perfect balance with p=1.0 (deterministic)', () => {
      const config: RandomizationConfig = {
        ...BASE_MIN_CONFIG,
        biasedCoinProbability: 1.0,
        targetEnrollment: 50,
        seed: 'deterministic_seed'
      };
      const result = generateRandomizationSchema(config);
      const countA = result.schema.filter(r => r.treatmentArmId === 'A').length;
      const countB = result.schema.filter(r => r.treatmentArmId === 'B').length;
      // With p=1.0 the imbalance should be very small (0 or 1 subject difference)
      expect(Math.abs(countA - countB)).toBeLessThanOrEqual(2);
    });

    it('assigns a stratum level to each subject from the configured factor', () => {
      const result = generateRandomizationSchema(BASE_MIN_CONFIG);
      const validLevels = BASE_MIN_CONFIG.strata[0].levels;
      for (const row of result.schema) {
        const level = row.stratum['age'];
        expect(validLevels).toContain(level);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-arm support
  // ─────────────────────────────────────────────────────────────────────────

  describe('multi-arm support', () => {
    it('distributes subjects across three arms', () => {
      const config: RandomizationConfig = {
        ...BASE_MIN_CONFIG,
        arms: [
          { id: 'A', name: 'High', ratio: 1 },
          { id: 'B', name: 'Low', ratio: 1 },
          { id: 'C', name: 'Placebo', ratio: 1 }
        ],
        targetEnrollment: 30,
        seed: 'three_arm_seed'
      };
      const result = generateRandomizationSchema(config);
      const ids = new Set(result.schema.map(r => r.treatmentArmId));
      expect(ids.size).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-site support
  // ─────────────────────────────────────────────────────────────────────────

  describe('multi-site support', () => {
    it('assigns subjects across all configured sites', () => {
      const config: RandomizationConfig = {
        ...BASE_MIN_CONFIG,
        sites: ['Site1', 'Site2', 'Site3'],
        targetEnrollment: 60,
        seed: 'multi_site_seed'
      };
      const result = generateRandomizationSchema(config);
      const sitesSeen = new Set(result.schema.map(r => r.site));
      expect(sitesSeen.size).toBeGreaterThan(1);
    });

    it('uses a single default site when sites array is empty', () => {
      const config: RandomizationConfig = {
        ...BASE_MIN_CONFIG,
        sites: [],
        targetEnrollment: 10
      };
      const result = generateRandomizationSchema(config);
      // Should still produce the target number of subjects
      expect(result.schema.length).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Unstratified (no strata factors)
  // ─────────────────────────────────────────────────────────────────────────

  describe('unstratified minimization', () => {
    it('runs without error when no stratification factors are defined', () => {
      const config: RandomizationConfig = {
        ...BASE_MIN_CONFIG,
        strata: [],
        targetEnrollment: 10
      };
      expect(() => generateRandomizationSchema(config)).not.toThrow();
    });

    it('generates exactly targetEnrollment subjects with no strata', () => {
      const config: RandomizationConfig = {
        ...BASE_MIN_CONFIG,
        strata: [],
        targetEnrollment: 10
      };
      const result = generateRandomizationSchema(config);
      expect(result.schema.length).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Method routing
  // ─────────────────────────────────────────────────────────────────────────

  describe('method routing', () => {
    it('defaults to PERMUTED_BLOCK when randomizationMethod is undefined', () => {
      const config: RandomizationConfig = {
        ...BASE_MIN_CONFIG,
        randomizationMethod: undefined,
        blockSizes: [4],
        stratumCaps: [{ levels: ['<65'], cap: 4 }, { levels: ['>=65'], cap: 4 }]
      };
      // Should not throw (permuted block is valid with these caps)
      const result = generateRandomizationSchema(config);
      expect(result.metadata.config.randomizationMethod).toBeUndefined();
    });
  });
});
