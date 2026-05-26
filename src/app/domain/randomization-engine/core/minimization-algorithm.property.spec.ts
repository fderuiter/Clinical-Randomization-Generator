import { describe, it, expect } from 'vitest';
import { generateMinimization } from './minimization-algorithm';
import seedrandom from 'seedrandom';
import { RandomizationConfig } from '../../core/models/randomization.model';

function generateRandomStrata(rng: seedrandom.PRNG, numStrata: number): any[] {
  const strata = [];
  for (let i = 0; i < numStrata; i++) {
    const numLevels = Math.floor(rng() * 3) + 2; // 2 to 4 levels
    const levels = [];
    const levelDetails = [];
    let remainingProb = 1.0;

    for (let j = 0; j < numLevels; j++) {
      levels.push(`Level${j + 1}`);

      let expectedProbability;
      if (j === numLevels - 1) {
        expectedProbability = remainingProb;
      } else {
        // Assign a random portion of remaining prob, keeping at least enough for others
        const maxProb = remainingProb - ((numLevels - 1 - j) * 0.1);
        expectedProbability = Math.max(0.1, rng() * maxProb);
        remainingProb -= expectedProbability;
      }

      levelDetails.push({
        name: `Level${j + 1}`,
        expectedProbability: expectedProbability
      });
    }

    strata.push({
      id: `stratum${i + 1}`,
      name: `Stratum ${i + 1}`,
      levels: levels,
      levelDetails: levelDetails
    });
  }
  return strata;
}

describe('Minimization Algorithm - Property-Based Tests', () => {
  const ITERATIONS = 50;

  it('Property 1 (Equal Ratio, P=1.0): strictly bounds imbalance', () => {
    const testRng = seedrandom('prop1-master');
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const seed = `prop1-${iter}-${testRng()}`;
      const configRng = seedrandom(seed);

      const totalSampleSize = Math.floor(configRng() * 181) + 20; // 20 to 200
      const numStrata = Math.floor(configRng() * 3) + 1; // 1 to 3

      const config: RandomizationConfig = {
        protocolId: `PROP1-${iter}`,
        studyName: 'Property Test 1',
        phase: 'II',
        arms: [
          { id: 'A', name: 'Active', ratio: 1 },
          { id: 'B', name: 'Placebo', ratio: 1 }
        ],
        sites: ['Site1'],
        strata: generateRandomStrata(configRng, numStrata),
        blockSizes: [4],
        stratumCaps: [],
        seed: seed,
        subjectIdMask: '{SITE}-{SEQ:3}',
        randomizationMethod: 'MINIMIZATION',
        minimizationConfig: { p: 1.0, totalSampleSize }
      };

      const algoRng = seedrandom(seed);
      const schema = generateMinimization(config, algoRng);

      const countA = schema.filter(r => r.treatmentArmId === 'A').length;
      const countB = schema.filter(r => r.treatmentArmId === 'B').length;

      expect(Math.abs(countA - countB)).toBeLessThanOrEqual(numStrata + 1);
    }
  });

  it('Property 2 (Variable P, Equal Ratio): bounds imbalance statistically', () => {
    const testRng = seedrandom('prop2-master');
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const seed = `prop2-${iter}-${testRng()}`;
      const configRng = seedrandom(seed);

      const totalSampleSize = Math.floor(configRng() * 181) + 20; // 20 to 200
      const p = 0.5 + (configRng() * 0.49); // 0.5 to 0.99
      const numStrata = Math.floor(configRng() * 3) + 1; // 1 to 3

      const config: RandomizationConfig = {
        protocolId: `PROP2-${iter}`,
        studyName: 'Property Test 2',
        phase: 'II',
        arms: [
          { id: 'A', name: 'Active', ratio: 1 },
          { id: 'B', name: 'Placebo', ratio: 1 }
        ],
        sites: ['Site1'],
        strata: generateRandomStrata(configRng, numStrata),
        blockSizes: [4],
        stratumCaps: [],
        seed: seed,
        subjectIdMask: '{SITE}-{SEQ:3}',
        randomizationMethod: 'MINIMIZATION',
        minimizationConfig: { p, totalSampleSize }
      };

      const algoRng = seedrandom(seed);
      const schema = generateMinimization(config, algoRng);

      const countA = schema.filter(r => r.treatmentArmId === 'A').length;
      const countB = schema.filter(r => r.treatmentArmId === 'B').length;

      const tolerance = Math.floor(totalSampleSize * 0.3) + numStrata + 2;
      expect(Math.abs(countA - countB)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('Property 3 (Extreme Ratio 5:1, P=1.0): scales balance with ratio', () => {
    const testRng = seedrandom('prop3-master');
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const seed = `prop3-${iter}-${testRng()}`;
      const configRng = seedrandom(seed);

      const totalSampleSize = Math.floor(configRng() * 181) + 20; // 20 to 200
      const numStrata = Math.floor(configRng() * 3) + 1; // 1 to 3

      const config: RandomizationConfig = {
        protocolId: `PROP3-${iter}`,
        studyName: 'Property Test 3',
        phase: 'II',
        arms: [
          { id: 'A', name: 'Active', ratio: 5 },
          { id: 'B', name: 'Placebo', ratio: 1 }
        ],
        sites: ['Site1'],
        strata: generateRandomStrata(configRng, numStrata),
        blockSizes: [4],
        stratumCaps: [],
        seed: seed,
        subjectIdMask: '{SITE}-{SEQ:3}',
        randomizationMethod: 'MINIMIZATION',
        minimizationConfig: { p: 1.0, totalSampleSize }
      };

      const algoRng = seedrandom(seed);
      const schema = generateMinimization(config, algoRng);

      const countA = schema.filter(r => r.treatmentArmId === 'A').length;
      const countB = schema.filter(r => r.treatmentArmId === 'B').length;

      // The overall count difference could be higher depending on exact random allocations across unbalanced strata.
      // E.g., if totalSampleSize is such that we're exactly mid-stride on the 5:1 ratio,
      // countA could be 5 ahead of what 5 * countB is. But with multiple strata interacting,
      // it can be slightly more. A safe bound:
      const tolerance = (numStrata * 5) + 5;
      expect(Math.abs(countA - (countB * 5))).toBeLessThanOrEqual(tolerance);
    }
  });

  it('Property 4 (Single Stratum, P=1.0): strongly bounds single-stratum imbalance', () => {
    const testRng = seedrandom('prop4-master');
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const seed = `prop4-${iter}-${testRng()}`;
      const configRng = seedrandom(seed);

      const totalSampleSize = Math.floor(configRng() * 181) + 20; // 20 to 200
      const numStrata = 1; // Exactly 1

      const config: RandomizationConfig = {
        protocolId: `PROP4-${iter}`,
        studyName: 'Property Test 4',
        phase: 'II',
        arms: [
          { id: 'A', name: 'Active', ratio: 1 },
          { id: 'B', name: 'Placebo', ratio: 1 }
        ],
        sites: ['Site1'],
        strata: generateRandomStrata(configRng, numStrata),
        blockSizes: [4],
        stratumCaps: [],
        seed: seed,
        subjectIdMask: '{SITE}-{SEQ:3}',
        randomizationMethod: 'MINIMIZATION',
        minimizationConfig: { p: 1.0, totalSampleSize }
      };

      const algoRng = seedrandom(seed);
      const schema = generateMinimization(config, algoRng);

      const countA = schema.filter(r => r.treatmentArmId === 'A').length;
      const countB = schema.filter(r => r.treatmentArmId === 'B').length;

      expect(Math.abs(countA - countB)).toBeLessThanOrEqual(numStrata + 2);
    }
  });
});
