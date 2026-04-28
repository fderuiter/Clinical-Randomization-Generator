import { describe, it, expect } from 'vitest';
import { generateMinimization } from './minimization-algorithm';
import seedrandom from 'seedrandom';
import { RandomizationConfig } from '../../core/models/randomization.model';

const baseConfig: RandomizationConfig = {
  protocolId: 'TEST-001',
  studyName: 'Test Study',
  phase: 'II',
  arms: [
    { id: 'A', name: 'Active', ratio: 1 },
    { id: 'B', name: 'Placebo', ratio: 1 }
  ],
  sites: ['Site1'],
  strata: [
    {
      id: 'sex',
      name: 'Sex',
      levels: ['Male', 'Female'],
      levelDetails: [
        { name: 'Male', expectedProbability: 0.5 },
        { name: 'Female', expectedProbability: 0.5 }
      ]
    }
  ],
  blockSizes: [4],
  stratumCaps: [],
  seed: 'test123',
  subjectIdMask: '{SITE}-{SEQ:3}',
  randomizationMethod: 'MINIMIZATION',
  minimizationConfig: { p: 0.8, totalSampleSize: 100 }
};

describe('generateMinimization', () => {
  it('generates the correct number of subjects', () => {
    const rng = seedrandom('test123');
    const schema = generateMinimization(baseConfig, rng);
    expect(schema.length).toBe(100);
  });

  it('assigns valid treatment arms only', () => {
    const rng = seedrandom('test123');
    const schema = generateMinimization(baseConfig, rng);
    const validArms = new Set(baseConfig.arms.map(a => a.id));
    for (const row of schema) {
      expect(validArms.has(row.treatmentArmId)).toBe(true);
    }
  });

  it('produces deterministic results with the same seed', () => {
    const schema1 = generateMinimization(baseConfig, seedrandom('abc'));
    const schema2 = generateMinimization(baseConfig, seedrandom('abc'));
    expect(schema1.map(r => r.treatmentArmId)).toEqual(schema2.map(r => r.treatmentArmId));
  });

  it('achieves reasonable balance with p=1.0', () => {
    const config = { ...baseConfig, minimizationConfig: { p: 1.0, totalSampleSize: 200 } };
    const schema = generateMinimization(config, seedrandom('balance'));
    const countA = schema.filter(r => r.treatmentArmId === 'A').length;
    const countB = schema.filter(r => r.treatmentArmId === 'B').length;
    expect(Math.abs(countA - countB)).toBeLessThanOrEqual(5);
  });

  it('respects sites: distributes subjects across sites', () => {
    const config = {
      ...baseConfig,
      sites: ['Site1', 'Site2'],
      minimizationConfig: { p: 0.8, totalSampleSize: 100 }
    };
    const schema = generateMinimization(config, seedrandom('sites'));
    const site1Count = schema.filter(r => r.site === 'Site1').length;
    const site2Count = schema.filter(r => r.site === 'Site2').length;
    expect(site1Count).toBeGreaterThan(30);
    expect(site2Count).toBeGreaterThan(30);
  });

  it('throws when p is outside [0.5, 1.0]', () => {
    const rng = seedrandom('test');
    expect(() => generateMinimization({ ...baseConfig, minimizationConfig: { p: 0.3, totalSampleSize: 100 } }, rng))
      .toThrow('Minimization probability p must be between 0.5 and 1.0');
    expect(() => generateMinimization({ ...baseConfig, minimizationConfig: { p: 1.1, totalSampleSize: 100 } }, rng))
      .toThrow('Minimization probability p must be between 0.5 and 1.0');
  });

  it('throws when totalSampleSize is not a positive integer', () => {
    const rng = seedrandom('test');
    expect(() => generateMinimization({ ...baseConfig, minimizationConfig: { p: 0.8, totalSampleSize: 0 } }, rng))
      .toThrow('Total sample size must be a positive integer');
    expect(() => generateMinimization({ ...baseConfig, minimizationConfig: { p: 0.8, totalSampleSize: -10 } }, rng))
      .toThrow('Total sample size must be a positive integer');
  });


describe('Minimization Algorithm - Detailed Fixes', () => {
  const customConfig: RandomizationConfig = {
    protocolId: 'TEST-002',
    studyName: 'Detailed Test Study',
    phase: 'II',
    arms: [
      { id: 'A', name: 'Active', ratio: 2 },
      { id: 'B', name: 'Placebo', ratio: 1 }
    ],
    sites: ['Site1'],
    strata: [
      {
        id: 'sex',
        name: 'Sex',
        levels: ['Male', 'Female'],
        levelDetails: [
          { name: 'Male', expectedProbability: 0.5 },
          { name: 'Female', expectedProbability: 0.5 }
        ]
      }
    ],
    blockSizes: [4],
    stratumCaps: [],
    seed: 'test1234',
    subjectIdMask: '{SITE}-{SEQ:3}',
    randomizationMethod: 'MINIMIZATION',
    minimizationConfig: { p: 1.0, totalSampleSize: 150 } // using p=1.0 makes it purely deterministic based on imbalance score
  };

  it('Issue 1: Imbalance score should evaluate variance against target proportions (2:1 ratio)', () => {
    // If Active has 4 and Placebo has 2, ratio is 2:1. Normalized should be 4/2 = 2 and 2/1 = 2.
    // The imbalance score should be exactly 0.
    // To test this we will mock the marginals within computeImbalanceScore or we can run the algorithm
    // and observe the generated balance.
    // Actually, with p=1.0 and 2:1 ratio, the final result should be exactly 100 A and 50 B.
    const rng = seedrandom('test1234');
    const schema = generateMinimization(customConfig, rng);

    const countA = schema.filter(r => r.treatmentArmId === 'A').length;

    // With 150 subjects and perfectly alternating to keep 2:1 ratio, we should get ~100 A and ~50 B.
    // Currently, it ignores ratio and forces 1:1 balance, yielding ~75 and ~75.
    expect(countA).toBeGreaterThanOrEqual(95);
    expect(countA).toBeLessThanOrEqual(105);
  });


  it('Issue 3: Probability Normalization - Under-allocated explicit probabilities', () => {
     // If explicit sum < 1.0, remaining should be divided equally among undefined.
     const configWithUndefinedLevels: RandomizationConfig = {
        ...customConfig,
        strata: [
          {
            id: 'bloodType',
            name: 'BloodType',
            levels: ['A', 'B', 'O', 'AB'],
            levelDetails: [
              { name: 'A', expectedProbability: 0.4 },
              { name: 'B', expectedProbability: undefined },
              { name: 'O', expectedProbability: undefined },
              { name: 'AB', expectedProbability: undefined }
            ]
          }
        ]
     };
     // Remaining 0.6 should be split 3 ways -> 0.2 each.
     const rng = seedrandom('probtest');
     const schema = generateMinimization(configWithUndefinedLevels, rng);

     const countA = schema.filter(r => r.stratum['bloodType'] === 'A').length;
     const countB = schema.filter(r => r.stratum['bloodType'] === 'B').length;
     const countO = schema.filter(r => r.stratum['bloodType'] === 'O').length;
     const countAB = schema.filter(r => r.stratum['bloodType'] === 'AB').length;

     // Currently, B, O, AB will get 0%, A gets 100%.
     // The fix should result in ~40% A, ~20% B, ~20% O, ~20% AB.
     expect(countA).toBeLessThan(150); // Should not be all A
     expect(countB).toBeGreaterThan(0);
     expect(countO).toBeGreaterThan(0);
     expect(countAB).toBeGreaterThan(0);
  });

    it('Issue 3: Probability Normalization - Over-allocated explicit probabilities', () => {
       // If explicit sum > 1.0, normalize proportionally and assign 0 to undefined.
       const configOverAllocated: RandomizationConfig = {
          ...customConfig,
          strata: [
            {
              id: 'bloodType',
              name: 'BloodType',
              levels: ['A', 'B', 'O', 'AB'],
              levelDetails: [
                { name: 'A', expectedProbability: 0.8 },
                { name: 'B', expectedProbability: 0.4 },
                { name: 'O', expectedProbability: undefined },
                { name: 'AB', expectedProbability: undefined }
              ]
            }
          ]
       };
       // Sum = 1.2. A gets 0.8/1.2 = 0.666, B gets 0.4/1.2 = 0.333. O and AB get 0.
       const rng = seedrandom('probtest_over');
       const schema = generateMinimization(configOverAllocated, rng);

       const countA = schema.filter(r => r.stratum['bloodType'] === 'A').length;
       const countB = schema.filter(r => r.stratum['bloodType'] === 'B').length;
       const countO = schema.filter(r => r.stratum['bloodType'] === 'O').length;
       const countAB = schema.filter(r => r.stratum['bloodType'] === 'AB').length;

       // Should be around 100 A, 50 B, 0 O, 0 AB.
       expect(countA).toBeGreaterThan(90);
       expect(countB).toBeGreaterThan(40);
       expect(countO).toBe(0);
       expect(countAB).toBe(0);
    });

    it('Issue 3: Probability Normalization - Exact sum of 1.0', () => {
       // If explicit sum == 1.0, undefined get 0.
       const configExactSum: RandomizationConfig = {
          ...customConfig,
          strata: [
            {
              id: 'bloodType',
              name: 'BloodType',
              levels: ['A', 'B', 'O', 'AB'],
              levelDetails: [
                { name: 'A', expectedProbability: 0.7 },
                { name: 'B', expectedProbability: 0.3 },
                { name: 'O', expectedProbability: undefined },
                { name: 'AB', expectedProbability: undefined }
              ]
            }
          ]
       };
       // A gets 0.7, B gets 0.3. O and AB get 0.
       const rng = seedrandom('probtest_exact');
       const schema = generateMinimization(configExactSum, rng);

       const countA = schema.filter(r => r.stratum['bloodType'] === 'A').length;
       const countB = schema.filter(r => r.stratum['bloodType'] === 'B').length;
       const countO = schema.filter(r => r.stratum['bloodType'] === 'O').length;
       const countAB = schema.filter(r => r.stratum['bloodType'] === 'AB').length;

       // Should be around 105 A, 45 B, 0 O, 0 AB.
       expect(countA).toBeGreaterThan(95);
       expect(countB).toBeGreaterThan(35);
     expect(countO).toBe(0);
     expect(countAB).toBe(0);
  });

  it('Issue 2: Uniform Tie-Breaking should throw Error if tie-breaker total weight is 0', () => {
     const configZeroRatio: RandomizationConfig = {
        ...customConfig,
        arms: [
          { id: 'A', name: 'Active', ratio: 0 },
          { id: 'B', name: 'Placebo', ratio: 0 }
        ]
     };
     const rng = seedrandom('probtest_zero_ratio');
     expect(() => generateMinimization(configZeroRatio, rng)).toThrow();
  });
});

  describe('Regression Prevention Tests', () => {
    it('Issue 5: Returns a truncated schema when total caps sum to less than totalSampleSize', () => {
      const restrictedConfig = {
        ...baseConfig,
        minimizationConfig: { p: 0.8, totalSampleSize: 100 },
        capStrategy: 'MANUAL_MATRIX' as const,
        stratumCaps: [
          { levels: ['Male'], cap: 20 },
          { levels: ['Female'], cap: 20 }
        ]
      };

      const rng = seedrandom('truncationTest');
      const schema = generateMinimization(restrictedConfig, rng);
      expect(schema.length).toBe(40);
    });

    it('Issue 5: Respects MARGINAL_ONLY caps exactly and dynamically recalculates probabilities', () => {
      const marginalConfig = {
        ...baseConfig,
        minimizationConfig: { p: 0.8, totalSampleSize: 50 },
        capStrategy: 'MARGINAL_ONLY' as const,
        strata: [
          {
            id: 'sex',
            name: 'Sex',
            levels: ['Male', 'Female'],
            levelDetails: [
              { name: 'Male', expectedProbability: 0.5, marginalCap: 5 },
              { name: 'Female', expectedProbability: 0.5 }
            ]
          }
        ]
      };

      const rng = seedrandom('marginalTest');
      const start = performance.now();
      const schema = generateMinimization(marginalConfig, rng);
      const end = performance.now();

      expect(end - start).toBeLessThan(100);

      const maleCount = schema.filter(r => r.stratum['sex'] === 'Male').length;
      const femaleCount = schema.filter(r => r.stratum['sex'] === 'Female').length;

      expect(maleCount).toBe(5);
      expect(femaleCount).toBe(45);
      expect(schema.length).toBe(50);
    });
  });
});
