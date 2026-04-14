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
    expect(site1Count).toBe(50);
    expect(site2Count).toBe(50);
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
});
