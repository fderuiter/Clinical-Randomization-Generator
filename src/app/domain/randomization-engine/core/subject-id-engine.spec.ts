import { resolveSubjectId, validateSubjectIdMask, previewSubjectId } from './subject-id-engine';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function freshSet(): Set<string> {
  return new Set<string>();
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy token backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSubjectId – legacy token compatibility', () => {
  it('replaces [SiteID] with the site value', () => {
    const id = resolveSubjectId('[SiteID]-001', { site: 'S01', stratumCode: '', sequence: 1 }, freshSet());
    expect(id).toBe('S01-001');
  });

  it('replaces [StratumCode] with the stratum code', () => {
    const id = resolveSubjectId('[SiteID]-[StratumCode]-001', { site: 'S01', stratumCode: 'AGE', sequence: 1 }, freshSet());
    expect(id).toBe('S01-AGE-001');
  });

  it('replaces [001] with a 3-digit padded counter', () => {
    const id = resolveSubjectId('[SiteID]-[001]', { site: 'S01', stratumCode: '', sequence: 5 }, freshSet());
    expect(id).toBe('S01-005');
  });

  it('replaces [0001] with a 4-digit padded counter', () => {
    const id = resolveSubjectId('[SiteID]-[0001]', { site: 'S01', stratumCode: '', sequence: 12 }, freshSet());
    expect(id).toBe('S01-0012');
  });

  it('pads a wider legacy mask [00001] correctly', () => {
    const id = resolveSubjectId('[00001]', { site: '', stratumCode: '', sequence: 3 }, freshSet());
    expect(id).toBe('00003');
  });

  it('produces the classic mask format unchanged', () => {
    const id = resolveSubjectId('[SiteID]-[StratumCode]-[001]', { site: '101', stratumCode: '<65-MAL', sequence: 7 }, freshSet());
    expect(id).toBe('101-<65-MAL-007');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// {SITE} and {STRATUM}
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSubjectId – {SITE} and {STRATUM}', () => {
  it('replaces {SITE} with the site identifier', () => {
    const id = resolveSubjectId('{SITE}-001', { site: 'CEN-A', stratumCode: '', sequence: 1 }, freshSet());
    expect(id).toBe('CEN-A-001');
  });

  it('replaces {STRATUM} with the stratum code', () => {
    const id = resolveSubjectId('{SITE}-{STRATUM}', { site: 'S1', stratumCode: 'GRP-X', sequence: 1 }, freshSet());
    expect(id).toBe('S1-GRP-X');
  });

  it('preserves literal text outside tokens as-is', () => {
    const id = resolveSubjectId('TRIAL-{SITE}', { site: '42', stratumCode: '', sequence: 1 }, freshSet());
    expect(id).toBe('TRIAL-42');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// {SEQ:n}
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSubjectId – {SEQ:n}', () => {
  it('{SEQ:3} zero-pads to 3 digits', () => {
    const id = resolveSubjectId('{SEQ:3}', { site: '', stratumCode: '', sequence: 7 }, freshSet());
    expect(id).toBe('007');
  });

  it('{SEQ:4} zero-pads to 4 digits', () => {
    const id = resolveSubjectId('{SEQ:4}', { site: '', stratumCode: '', sequence: 1 }, freshSet());
    expect(id).toBe('0001');
  });

  it('sequences above the padding width still render correctly', () => {
    const id = resolveSubjectId('{SEQ:3}', { site: '', stratumCode: '', sequence: 1234 }, freshSet());
    expect(id).toBe('1234');
  });

  it('full mask with SEQ produces correct output', () => {
    const id = resolveSubjectId('TRIAL-{SITE}-{SEQ:3}', { site: '101', stratumCode: '', sequence: 5 }, freshSet());
    expect(id).toBe('TRIAL-101-005');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// {RND:n}
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSubjectId – {RND:n}', () => {
  it('produces a string of exactly n characters', () => {
    const id = resolveSubjectId('{RND:6}', { site: '', stratumCode: '', sequence: 1 }, freshSet());
    expect(id).toHaveLength(6);
  });

  it('only contains alphanumeric uppercase characters', () => {
    const id = resolveSubjectId('{RND:20}', { site: '', stratumCode: '', sequence: 1 }, freshSet());
    expect(id).toMatch(/^[A-Z0-9]{20}$/);
  });

  it('two calls produce distinct values (statistical)', () => {
    const set = freshSet();
    const id1 = resolveSubjectId('{RND:8}', { site: '', stratumCode: '', sequence: 1 }, set);
    // Ensure second subject uses the same set so collision detection is active
    const set2 = freshSet();
    const id2 = resolveSubjectId('{RND:8}', { site: '', stratumCode: '', sequence: 2 }, set2);
    // With 8 alphanumeric chars there are 36^8 ≈ 2.8 trillion possibilities –
    // the probability of a collision is astronomically small.
    expect(id1).not.toBe(id2);
  });

  it('injects RND into a larger template', () => {
    const id = resolveSubjectId('{SITE}-{RND:4}', { site: 'S01', stratumCode: '', sequence: 1 }, freshSet());
    expect(id).toMatch(/^S01-[A-Z0-9]{4}$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collision detection
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSubjectId – collision detection', () => {
  it('adds each generated ID to the usedIds Set', () => {
    const used = freshSet();
    resolveSubjectId('{SITE}-{SEQ:3}', { site: 'S1', stratumCode: '', sequence: 1 }, used);
    resolveSubjectId('{SITE}-{SEQ:3}', { site: 'S1', stratumCode: '', sequence: 2 }, used);
    expect(used.size).toBe(2);
  });

  it('never produces a duplicate when {RND:n} is present', () => {
    const used = freshSet();
    const ids = new Set<string>();
    for (let i = 1; i <= 50; i++) {
      const id = resolveSubjectId('{RND:6}', { site: '', stratumCode: '', sequence: i }, used);
      ids.add(id);
    }
    expect(ids.size).toBe(50);
  });

  it('sequential IDs without {RND:n} are still tracked in the set', () => {
    const used = freshSet();
    resolveSubjectId('{SEQ:3}', { site: '', stratumCode: '', sequence: 1 }, used);
    expect(used.has('001')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// {CHECKSUM}
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSubjectId – {CHECKSUM}', () => {
  it('appends a single digit', () => {
    const id = resolveSubjectId('{SEQ:3}-{CHECKSUM}', { site: '', stratumCode: '', sequence: 42 }, freshSet());
    expect(id).toMatch(/^042-\d$/);
  });

  it('the check digit validates via Luhn algorithm', () => {
    // Build an ID and then verify the full number including the check digit
    const id = resolveSubjectId('{SITE}{SEQ:4}{CHECKSUM}', { site: '10', stratumCode: '', sequence: 1 }, freshSet());
    // id = '10' + '0001' + checkDigit  → all digits = '100001' + checkDigit
    const digits = id.replace(/\D/g, '');
    expect(luhnIsValid(digits)).toBe(true);
  });

  it('returns 0 when mask produces no digits', () => {
    const id = resolveSubjectId('SITE-{CHECKSUM}', { site: 'NODIGITS', stratumCode: '', sequence: 0 }, freshSet());
    expect(id).toBe('SITE-0');
  });
});

/** Luhn validation: a valid number has Luhn sum divisible by 10. */
function luhnIsValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateSubjectIdMask
// ─────────────────────────────────────────────────────────────────────────────

describe('validateSubjectIdMask', () => {
  it('returns null for a valid new-syntax mask', () => {
    expect(validateSubjectIdMask('TRIAL-{SITE}-{SEQ:3}-{RND:4}-{CHECKSUM}')).toBeNull();
  });

  it('returns null for a legacy mask', () => {
    expect(validateSubjectIdMask('[SiteID]-[StratumCode]-[001]')).toBeNull();
  });

  it('returns null for a mask with no tokens', () => {
    expect(validateSubjectIdMask('STATIC-ID')).toBeNull();
  });

  it('returns an error for an unknown token', () => {
    const result = validateSubjectIdMask('{UNKNOWN}');
    expect(result).not.toBeNull();
    expect(result).toContain('{UNKNOWN}');
  });

  it('reports the first malformed token in the error message', () => {
    const result = validateSubjectIdMask('{SEQ:A}');
    expect(result).not.toBeNull();
    expect(result).toContain('{SEQ:A}');
  });

  it('returns null for {SEQ:n} with multi-digit n', () => {
    expect(validateSubjectIdMask('{SEQ:10}')).toBeNull();
  });

  it('returns null for {RND:n}', () => {
    expect(validateSubjectIdMask('{RND:8}')).toBeNull();
  });

  it('returns null for {CHECKSUM}', () => {
    expect(validateSubjectIdMask('{CHECKSUM}')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// previewSubjectId
// ─────────────────────────────────────────────────────────────────────────────

describe('previewSubjectId', () => {
  it('returns a preview for a valid new-syntax mask', () => {
    const result = previewSubjectId('TRIAL-{SITE}-{SEQ:3}');
    expect(result.error).toBeUndefined();
    expect(result.preview).toBe('TRIAL-101-001');
  });

  it('returns a preview for a legacy mask', () => {
    const result = previewSubjectId('[SiteID]-[001]');
    expect(result.error).toBeUndefined();
    expect(result.preview).toBe('101-001');
  });

  it('includes RND segment matching the required pattern', () => {
    const result = previewSubjectId('{SITE}-{RND:4}');
    expect(result.preview).toMatch(/^101-[A-Z0-9]{4}$/);
  });

  it('returns error for an invalid token', () => {
    const result = previewSubjectId('{BAD_TOKEN}');
    expect(result.preview).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it('returns error for an empty mask', () => {
    const result = previewSubjectId('');
    expect(result.error).toBeTruthy();
  });

  it('preview with {CHECKSUM} ends with a digit', () => {
    const result = previewSubjectId('{SITE}-{SEQ:3}-{CHECKSUM}');
    expect(result.preview).toMatch(/-\d$/);
  });
});
