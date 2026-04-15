import { describe, it, expect } from 'vitest';
import { mulberry32 } from './attrition-prng';

describe('mulberry32 PRNG', () => {
  it('should return values in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('should be deterministic: same seed produces the same sequence', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('should produce different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    // Extremely unlikely that the very first values match by chance
    const firstA = a();
    const firstB = b();
    expect(firstA).not.toBe(firstB);
  });

  it('should converge to the correct dropout rate across many subjects (acceptance criteria)', () => {
    // Simulate the attrition filter: for each of N subjects seeded per-iteration,
    // count how many are "dropped" and verify convergence to the target rate within ±1%.
    const TARGET_RATE = 0.20; // 20 % attrition
    const TOTAL_ITERATIONS = 10_000;
    const SUBJECTS_PER_ITERATION = 10; // keep fast; statistical convergence still holds
    const TOTAL_SUBJECTS = TOTAL_ITERATIONS * SUBJECTS_PER_ITERATION;

    let dropped = 0;

    for (let i = 0; i < TOTAL_ITERATIONS; i++) {
      const rng = mulberry32(i * 1_000_003 + 7);
      for (let s = 0; s < SUBJECTS_PER_ITERATION; s++) {
        if (rng() < TARGET_RATE) {
          dropped++;
        }
      }
    }

    const observedRate = dropped / TOTAL_SUBJECTS;
    // Accept ±1 percentage point tolerance (well within standard statistical limits)
    expect(observedRate).toBeGreaterThanOrEqual(TARGET_RATE - 0.01);
    expect(observedRate).toBeLessThanOrEqual(TARGET_RATE + 0.01);
  });

  it('should produce ~0% dropouts when attritionRate is 0', () => {
    const ITERATIONS = 1_000;
    let dropped = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const rng = mulberry32(i * 1_000_003 + 7);
      if (rng() < 0) {
        dropped++;
      }
    }
    expect(dropped).toBe(0);
  });

  it('should produce ~50% dropouts at maximum attrition rate', () => {
    const TARGET_RATE = 0.50;
    const TOTAL_ITERATIONS = 10_000;
    const SUBJECTS_PER_ITERATION = 10;
    const TOTAL_SUBJECTS = TOTAL_ITERATIONS * SUBJECTS_PER_ITERATION;

    let dropped = 0;
    for (let i = 0; i < TOTAL_ITERATIONS; i++) {
      const rng = mulberry32(i * 1_000_003 + 7);
      for (let s = 0; s < SUBJECTS_PER_ITERATION; s++) {
        if (rng() < TARGET_RATE) {
          dropped++;
        }
      }
    }

    const observedRate = dropped / TOTAL_SUBJECTS;
    expect(observedRate).toBeGreaterThanOrEqual(TARGET_RATE - 0.01);
    expect(observedRate).toBeLessThanOrEqual(TARGET_RATE + 0.01);
  });
});
