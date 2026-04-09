import { describe, it, expect } from 'vitest';
import { computeProportionalCaps, validateProportionalPercentages } from './cap-strategy';
import { StratificationFactor } from '../../core/models/randomization.model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const gender: StratificationFactor = { id: 'gender', name: 'Gender', levels: ['Male', 'Female'] };
const diabetes: StratificationFactor = { id: 'diabetes', name: 'Diabetes', levels: ['Diabetic', 'Non-Diabetic'] };

// ---------------------------------------------------------------------------
// validateProportionalPercentages
// ---------------------------------------------------------------------------

describe('validateProportionalPercentages', () => {
  it('returns empty object when all factors sum to 100', () => {
    const result = validateProportionalPercentages(
      [gender],
      { gender: { Male: 60, Female: 40 } }
    );
    expect(result).toEqual({});
  });

  it('returns factorId = true when percentages do not sum to 100', () => {
    const result = validateProportionalPercentages(
      [gender],
      { gender: { Male: 50, Female: 40 } } // sums to 90
    );
    expect(result['gender']).toBe(true);
  });

  it('treats missing levels as 0', () => {
    const result = validateProportionalPercentages(
      [gender],
      { gender: { Male: 100 } } // Female missing → 0, total = 100
    );
    expect(result).toEqual({});
  });

  it('validates multiple factors independently', () => {
    const result = validateProportionalPercentages(
      [gender, diabetes],
      {
        gender: { Male: 60, Female: 40 },   // valid
        diabetes: { Diabetic: 50, 'Non-Diabetic': 40 } // invalid (90)
      }
    );
    expect(result['gender']).toBeUndefined();
    expect(result['diabetes']).toBe(true);
  });

  it('accepts floating-point sums within tolerance (0.001)', () => {
    const result = validateProportionalPercentages(
      [gender],
      { gender: { Male: 33.333, Female: 66.667 } } // sums to 100.000
    );
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// computeProportionalCaps – basic behaviour
// ---------------------------------------------------------------------------

describe('computeProportionalCaps – basic behaviour', () => {
  it('returns one cap per intersection', () => {
    const caps = computeProportionalCaps(
      [gender],
      100,
      { gender: { Male: 60, Female: 40 } }
    );
    expect(caps.length).toBe(2);
  });

  it('sum of all caps equals the global cap (no strata)', () => {
    const caps = computeProportionalCaps([], 100, {});
    const total = caps.reduce((s, c) => s + c.cap, 0);
    expect(total).toBe(100);
  });

  it('sum of caps equals the global cap for a single factor', () => {
    const caps = computeProportionalCaps(
      [gender],
      100,
      { gender: { Male: 60, Female: 40 } }
    );
    const total = caps.reduce((s, c) => s + c.cap, 0);
    expect(total).toBe(100);
  });

  it('assigns the correct floor caps when percentages yield clean integers', () => {
    const caps = computeProportionalCaps(
      [gender],
      100,
      { gender: { Male: 60, Female: 40 } }
    );
    const maleCap = caps.find(c => c.levels.includes('Male'))!.cap;
    const femaleCap = caps.find(c => c.levels.includes('Female'))!.cap;
    expect(maleCap).toBe(60);
    expect(femaleCap).toBe(40);
  });

  it('sum of caps equals global cap for two factors (Cartesian product)', () => {
    const caps = computeProportionalCaps(
      [gender, diabetes],
      100,
      {
        gender: { Male: 60, Female: 40 },
        diabetes: { Diabetic: 30, 'Non-Diabetic': 70 }
      }
    );
    expect(caps.length).toBe(4); // 2 × 2
    const total = caps.reduce((s, c) => s + c.cap, 0);
    expect(total).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeProportionalCaps – Largest Remainder Method
// ---------------------------------------------------------------------------

describe('computeProportionalCaps – Largest Remainder Method', () => {
  it('still sums to global cap even with unequal three-level split', () => {
    // 1/3 each: theoretical = 33.333..., floors sum = 99, one remainder seat awarded
    const age: StratificationFactor = {
      id: 'age', name: 'Age', levels: ['Young', 'Middle', 'Old']
    };
    const caps = computeProportionalCaps(
      [age],
      100,
      { age: { Young: 33.333, Middle: 33.333, Old: 33.334 } }
    );
    const total = caps.reduce((s, c) => s + c.cap, 0);
    expect(total).toBe(100);
  });

  it('issue example: 60% Male, 30% Diabetic, global cap 100 → intersection ≈ 18', () => {
    // Male+Diabetic = 0.60 × 0.30 × 100 = 18.0 (exact)
    const caps = computeProportionalCaps(
      [gender, diabetes],
      100,
      {
        gender: { Male: 60, Female: 40 },
        diabetes: { Diabetic: 30, 'Non-Diabetic': 70 }
      }
    );
    const maleDiabeticCap = caps.find(
      c => c.levels.includes('Male') && c.levels.includes('Diabetic')
    )!.cap;
    expect(maleDiabeticCap).toBe(18);
  });

  it('never produces a negative cap', () => {
    const caps = computeProportionalCaps(
      [gender, diabetes],
      10,
      {
        gender: { Male: 60, Female: 40 },
        diabetes: { Diabetic: 30, 'Non-Diabetic': 70 }
      }
    );
    caps.forEach(c => expect(c.cap).toBeGreaterThanOrEqual(0));
  });

  it('sums to global cap when the cap is small (1)', () => {
    const caps = computeProportionalCaps(
      [gender],
      1,
      { gender: { Male: 60, Female: 40 } }
    );
    const total = caps.reduce((s, c) => s + c.cap, 0);
    expect(total).toBe(1);
  });

  it('sums to global cap for a large trial (10 000 subjects)', () => {
    const age: StratificationFactor = {
      id: 'age', name: 'Age', levels: ['Young', 'Middle', 'Old']
    };
    const caps = computeProportionalCaps(
      [age, gender],
      10000,
      {
        age: { Young: 33.333, Middle: 33.333, Old: 33.334 },
        gender: { Male: 60, Female: 40 }
      }
    );
    const total = caps.reduce((s, c) => s + c.cap, 0);
    expect(total).toBe(10000);
  });
});
