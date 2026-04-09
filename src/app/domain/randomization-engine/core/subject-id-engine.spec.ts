import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateSubjectIdMask,
  previewSubjectIdMask,
  generateSubjectId,
  luhnCheckDigit
} from './subject-id-engine';

// ─────────────────────────────────────────────────────────────────────────────
// validateSubjectIdMask
// ─────────────────────────────────────────────────────────────────────────────

describe('validateSubjectIdMask', () => {
  it('returns valid for a plain-text mask', () => {
    expect(validateSubjectIdMask('TRIAL-001').valid).toBe(true);
  });

  it('returns valid for a mask with {SITE}', () => {
    expect(validateSubjectIdMask('{SITE}-001').valid).toBe(true);
  });

  it('returns valid for a mask with {STRATUM}', () => {
    expect(validateSubjectIdMask('{STRATUM}-001').valid).toBe(true);
  });

  it('returns valid for a mask with {SEQ:3}', () => {
    expect(validateSubjectIdMask('{SITE}-{SEQ:3}').valid).toBe(true);
  });

  it('returns valid for a mask with {RND:6}', () => {
    expect(validateSubjectIdMask('{SITE}-{RND:6}').valid).toBe(true);
  });

  it('returns valid for a mask with {CHECKSUM}', () => {
    expect(validateSubjectIdMask('{SITE}-{SEQ:3}-{CHECKSUM}').valid).toBe(true);
  });

  it('returns valid for a legacy [SiteID] mask', () => {
    expect(validateSubjectIdMask('[SiteID]-[001]').valid).toBe(true);
  });

  it('returns invalid for {SEQ:A} (non-numeric padding)', () => {
    const result = validateSubjectIdMask('{SITE}-{SEQ:A}');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/SEQ/);
  });

  it('returns invalid for {RND:abc} (non-numeric length)', () => {
    const result = validateSubjectIdMask('{RND:abc}');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/RND/);
  });

  it('returns invalid for {SEQ:} (empty param)', () => {
    expect(validateSubjectIdMask('{SEQ:}').valid).toBe(false);
  });

  it('returns invalid for {RND:} (empty param)', () => {
    expect(validateSubjectIdMask('{RND:}').valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// luhnCheckDigit
// ─────────────────────────────────────────────────────────────────────────────

describe('luhnCheckDigit', () => {
  it('returns 0 for an empty string', () => {
    expect(luhnCheckDigit('')).toBe('0');
  });

  it('returns 0 when there are no numeric characters', () => {
    expect(luhnCheckDigit('SITE-ABC')).toBe('0');
  });

  it('produces a single decimal digit (0–9)', () => {
    const digit = luhnCheckDigit('12345');
    expect(digit).toMatch(/^\d$/);
  });

  it('returns a consistent digit for the same input', () => {
    expect(luhnCheckDigit('101-001')).toBe(luhnCheckDigit('101-001'));
  });

  it('strips non-numeric characters before computing', () => {
    // '101001' extracted from 'TRIAL-101-001'
    expect(luhnCheckDigit('TRIAL-101-001')).toBe(luhnCheckDigit('101001'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// previewSubjectIdMask
// ─────────────────────────────────────────────────────────────────────────────

describe('previewSubjectIdMask', () => {
  it('replaces {SITE} with the provided site', () => {
    expect(previewSubjectIdMask('{SITE}-001', '202')).toBe('202-001');
  });

  it('replaces {STRATUM} with STR placeholder', () => {
    expect(previewSubjectIdMask('{STRATUM}-001')).toContain('STR');
  });

  it('replaces {SEQ:3} with zero-padded sequence', () => {
    expect(previewSubjectIdMask('{SITE}-{SEQ:3}', '101', 1)).toBe('101-001');
  });

  it('replaces {SEQ:5} with 5-digit padding', () => {
    expect(previewSubjectIdMask('{SEQ:5}', '101', 1)).toBe('00001');
  });

  it('replaces {RND:4} with a deterministic 4-char preview placeholder', () => {
    const result = previewSubjectIdMask('{RND:4}');
    expect(result).toHaveLength(4);
  });

  it('replaces {CHECKSUM} with a computed check digit', () => {
    const result = previewSubjectIdMask('{SITE}-{SEQ:3}-{CHECKSUM}', '101', 1);
    // Should produce something like '101-001-<digit>'
    expect(result).toMatch(/^101-001-\d$/);
  });

  it('returns an error message for an invalid mask', () => {
    const result = previewSubjectIdMask('{SEQ:A}');
    expect(result).toMatch(/Invalid/i);
  });

  it('preserves plain-text prefix and suffix', () => {
    const result = previewSubjectIdMask('TRIAL-{SITE}-END', '101');
    expect(result).toBe('TRIAL-101-END');
  });

  it('supports legacy [SiteID] token', () => {
    expect(previewSubjectIdMask('[SiteID]-001', '202')).toBe('202-001');
  });

  it('supports legacy [001] token', () => {
    const result = previewSubjectIdMask('[SiteID]-[001]', '101', 1);
    expect(result).toBe('101-001');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateSubjectId – deterministic tokens
// ─────────────────────────────────────────────────────────────────────────────

describe('generateSubjectId – deterministic tokens', () => {
  let usedIds: Set<string>;

  beforeEach(() => { usedIds = new Set(); });

  it('resolves {SITE} correctly', () => {
    const id = generateSubjectId('{SITE}-001', { site: 'SiteA', stratumCode: '', sequence: 1 }, usedIds);
    expect(id).toBe('SiteA-001');
  });

  it('resolves {STRATUM} correctly', () => {
    const id = generateSubjectId('{STRATUM}-001', { site: '', stratumCode: 'AGE', sequence: 1 }, usedIds);
    expect(id).toBe('AGE-001');
  });

  it('resolves {SEQ:4} with 4-digit padding', () => {
    const id = generateSubjectId('{SEQ:4}', { site: '', stratumCode: '', sequence: 7 }, usedIds);
    expect(id).toBe('0007');
  });

  it('resolves {CHECKSUM} as a trailing check digit', () => {
    const id = generateSubjectId('{SITE}-{SEQ:3}-{CHECKSUM}', { site: '101', stratumCode: '', sequence: 1 }, usedIds);
    expect(id).toMatch(/^101-001-\d$/);
    // Checksum digit must be reproducible
    const id2 = generateSubjectId('{SITE}-{SEQ:3}-{CHECKSUM}', { site: '101', stratumCode: '', sequence: 1 }, new Set());
    expect(id).toBe(id2);
  });

  it('registers each generated ID in the usedIds Set', () => {
    generateSubjectId('{SITE}-{SEQ:3}', { site: '101', stratumCode: '', sequence: 1 }, usedIds);
    expect(usedIds.has('101-001')).toBe(true);
  });

  it('supports the legacy [SiteID]-[001] mask', () => {
    const id = generateSubjectId('[SiteID]-[001]', { site: 'Site1', stratumCode: '', sequence: 3 }, usedIds);
    expect(id).toBe('Site1-003');
  });

  it('supports the legacy [SiteID]-[0001] mask (4-digit padding)', () => {
    const id = generateSubjectId('[SiteID]-[0001]', { site: 'Site1', stratumCode: '', sequence: 3 }, usedIds);
    expect(id).toBe('Site1-0003');
  });

  it('supports legacy [StratumCode] token', () => {
    const id = generateSubjectId('[SiteID]-[StratumCode]-[001]', { site: 'S1', stratumCode: 'AGE', sequence: 2 }, usedIds);
    expect(id).toBe('S1-AGE-002');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateSubjectId – {RND:n} token & collision detection
// ─────────────────────────────────────────────────────────────────────────────

describe('generateSubjectId – {RND:n} and collision detection', () => {
  it('generates an alphanumeric string of the requested length', () => {
    const usedIds = new Set<string>();
    const id = generateSubjectId('{RND:6}', { site: '', stratumCode: '', sequence: 1 }, usedIds);
    expect(id).toHaveLength(6);
    expect(id).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('does not produce a duplicate within the same generation cycle', () => {
    const usedIds = new Set<string>();
    const ids = new Set<string>();
    // Generate 50 IDs with a small (4-char) random segment – collisions are possible
    // but the engine should re-roll to guarantee uniqueness
    for (let i = 0; i < 50; i++) {
      ids.add(generateSubjectId('{RND:4}', { site: '', stratumCode: '', sequence: i }, usedIds));
    }
    expect(ids.size).toBe(50);
  });

  it('adds the generated ID to the usedIds Set', () => {
    const usedIds = new Set<string>();
    const id = generateSubjectId('{SITE}-{RND:4}', { site: 'X', stratumCode: '', sequence: 1 }, usedIds);
    expect(usedIds.has(id)).toBe(true);
  });
});
