import { generateRandomizationSchema } from './randomization-algorithm';
import { RandomizationConfig } from '../../core/models/randomization.model';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal valid config: 2 arms 1:1, 1 site, 4-block, 4-subject cap, fixed seed. */
const BASE_CONFIG: RandomizationConfig = {
  protocolId: 'ALG-001',
  studyName: 'Algorithm Test',
  phase: 'Phase II',
  arms: [
    { id: 'A', name: 'Active', ratio: 1 },
    { id: 'B', name: 'Placebo', ratio: 1 }
  ],
  sites: ['Site1'],
  strata: [],
  blockSizes: [4],
  stratumCaps: [{ levels: [], cap: 4 }],
  seed: 'alg_seed',
  subjectIdMask: '[SiteID]-[001]'
};

// ─────────────────────────────────────────────────────────────────────────────
// Core behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – core behaviour', () => {
  it('returns a result object with schema and metadata', () => {
    const result = generateRandomizationSchema(BASE_CONFIG);
    expect(result).toHaveProperty('schema');
    expect(result).toHaveProperty('metadata');
  });

  it('respects the cap: generates exactly cap subjects per site/stratum combination', () => {
    const result = generateRandomizationSchema(BASE_CONFIG);
    expect(result.schema.length).toBe(4);
  });

  it('populates required fields on every schema row', () => {
    const result = generateRandomizationSchema(BASE_CONFIG);
    for (const row of result.schema) {
      expect(row.subjectId).toBeTruthy();
      expect(row.site).toBeTruthy();
      expect(typeof row.blockNumber).toBe('number');
      expect(typeof row.blockSize).toBe('number');
      expect(row.treatmentArm).toBeTruthy();
      expect(row.treatmentArmId).toBeTruthy();
    }
  });

  it('includes only the configured site identifiers', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      sites: ['SiteA', 'SiteB'],
      stratumCaps: [{ levels: [], cap: 2 }]
    };
    const result = generateRandomizationSchema(config);
    const sites = [...new Set(result.schema.map(r => r.site))];
    expect(sites.sort()).toEqual(['SiteA', 'SiteB']);
  });

  it('assigns a generatedAt ISO timestamp', () => {
    const result = generateRandomizationSchema(BASE_CONFIG);
    expect(() => new Date(result.metadata.generatedAt)).not.toThrow();
    expect(new Date(result.metadata.generatedAt).getFullYear()).toBeGreaterThan(2020);
  });

  it('copies config verbatim into metadata.config', () => {
    const result = generateRandomizationSchema(BASE_CONFIG);
    expect(result.metadata.config).toEqual(BASE_CONFIG);
    expect(result.metadata.protocolId).toBe(BASE_CONFIG.protocolId);
    expect(result.metadata.studyName).toBe(BASE_CONFIG.studyName);
    expect(result.metadata.phase).toBe(BASE_CONFIG.phase);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Seeding & reproducibility
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – seeding', () => {
  it('produces identical arm sequences when called twice with the same seed', () => {
    const r1 = generateRandomizationSchema(BASE_CONFIG);
    const r2 = generateRandomizationSchema(BASE_CONFIG);
    expect(r1.schema.map(r => r.treatmentArmId)).toEqual(r2.schema.map(r => r.treatmentArmId));
  });

  it('produces different sequences for different seeds', () => {
    const r1 = generateRandomizationSchema(BASE_CONFIG);
    const r2 = generateRandomizationSchema({ ...BASE_CONFIG, seed: 'different_seed' });
    const match = r1.schema.map(r => r.treatmentArmId).join() === r2.schema.map(r => r.treatmentArmId).join();
    expect(match).toBe(false);
  });

  it('auto-generates a non-empty seed when seed is empty string', () => {
    const result = generateRandomizationSchema({ ...BASE_CONFIG, seed: '' });
    expect(result.metadata.seed).toBeTruthy();
    expect(result.metadata.seed.length).toBeGreaterThan(0);
  });

  it('stores the resolved seed in metadata even when auto-generated', () => {
    const r1 = generateRandomizationSchema({ ...BASE_CONFIG, seed: '' });
    const r2 = generateRandomizationSchema({ ...BASE_CONFIG, seed: r1.metadata.seed });
    // Using the captured seed must reproduce the same sequence
    expect(r1.schema.map(r => r.treatmentArmId)).toEqual(r2.schema.map(r => r.treatmentArmId));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block structure
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – block structure', () => {
  it('throws when any block size is not a multiple of the total ratio', () => {
    expect(() =>
      generateRandomizationSchema({ ...BASE_CONFIG, blockSizes: [3] }) // 3 % 2 !== 0
    ).toThrow(/not a multiple/);
  });

  it('includes the offending block size in the error message', () => {
    expect(() =>
      generateRandomizationSchema({ ...BASE_CONFIG, blockSizes: [5] })
    ).toThrow('5');
  });

  it('throws only for invalid sizes even when the list also contains valid ones', () => {
    expect(() =>
      generateRandomizationSchema({ ...BASE_CONFIG, blockSizes: [4, 3] })
    ).toThrow(/not a multiple/);
  });

  it('accepts multiple valid block sizes without throwing', () => {
    expect(() =>
      generateRandomizationSchema({ ...BASE_CONFIG, blockSizes: [4, 6] })
    ).not.toThrow();
  });

  it('increments blockNumber across blocks within a stratum', () => {
    const config: RandomizationConfig = { ...BASE_CONFIG, blockSizes: [2], stratumCaps: [{ levels: [], cap: 6 }] };
    const result = generateRandomizationSchema(config);
    const blockNumbers = result.schema.map(r => r.blockNumber);
    expect(Math.max(...blockNumbers)).toBeGreaterThan(1);
  });

  it('each row records the correct blockSize that was selected', () => {
    const result = generateRandomizationSchema(BASE_CONFIG);
    result.schema.forEach(row => expect(row.blockSize).toBe(4));
  });

  it('balances arm allocation within each block (1:1 ratio)', () => {
    // With a block size of 4 and 1:1 ratio every block must have exactly 2 of each arm
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      blockSizes: [4],
      stratumCaps: [{ levels: [], cap: 4 }],
      seed: 'balance_seed'
    };
    const result = generateRandomizationSchema(config);
    const active = result.schema.filter(r => r.treatmentArmId === 'A').length;
    const placebo = result.schema.filter(r => r.treatmentArmId === 'B').length;
    expect(active).toBe(placebo);
  });

  it('respects a non-equal ratio (2:1)', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      arms: [{ id: 'A', name: 'Drug', ratio: 2 }, { id: 'B', name: 'Placebo', ratio: 1 }],
      blockSizes: [3],
      stratumCaps: [{ levels: [], cap: 6 }]
    };
    const result = generateRandomizationSchema(config);
    const drug = result.schema.filter(r => r.treatmentArmId === 'A').length;
    const placebo = result.schema.filter(r => r.treatmentArmId === 'B').length;
    // 6 subjects at 2:1 → 4 Drug, 2 Placebo
    expect(drug).toBe(4);
    expect(placebo).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stratification
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – stratification', () => {
  it('generates the Cartesian product of strata levels', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      strata: [
        { id: 'age', name: 'Age', levels: ['<65', '>=65'] },
        { id: 'gender', name: 'Gender', levels: ['M', 'F'] }
      ],
      stratumCaps: [
        { levels: ['<65', 'M'], cap: 4 },
        { levels: ['<65', 'F'], cap: 4 },
        { levels: ['>=65', 'M'], cap: 4 },
        { levels: ['>=65', 'F'], cap: 4 }
      ]
    };
    const result = generateRandomizationSchema(config);
    expect(result.schema.length).toBe(16); // 4 strata × 4 subjects each
  });

  it('stores the stratum combination on each row', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      strata: [{ id: 'age', name: 'Age', levels: ['<65', '>=65'] }],
      stratumCaps: [{ levels: ['<65'], cap: 2 }, { levels: ['>=65'], cap: 2 }]
    };
    const result = generateRandomizationSchema(config);
    result.schema.forEach(row => {
      expect(row.stratum).toBeTruthy();
      const ageVal = row.stratum['age'];
      expect(['<65', '>=65']).toContain(ageVal);
    });
  });

  it('generates a stratumCode from the first 3 chars of each level (uppercased)', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      strata: [
        { id: 'age', name: 'Age', levels: ['under65'] },
        { id: 'gender', name: 'Gender', levels: ['male'] }
      ],
      stratumCaps: [{ levels: ['under65', 'male'], cap: 2 }]
    };
    const result = generateRandomizationSchema(config);
    expect(result.schema[0].stratumCode).toBe('UND-MAL');
  });

  it('produces zero subjects when no cap is defined for a stratum combination', () => {
    // capsDict lookup returns 0 for unknown combos → while loop never executes
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      strata: [{ id: 'age', name: 'Age', levels: ['<65', '>=65'] }],
      stratumCaps: [] // no caps → everything 0
    };
    const result = generateRandomizationSchema(config);
    expect(result.schema.length).toBe(0);
  });

  it('only generates subjects up to the per-stratum cap', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      strata: [{ id: 'sex', name: 'Sex', levels: ['M', 'F'] }],
      stratumCaps: [
        { levels: ['M'], cap: 6 },
        { levels: ['F'], cap: 2 }
      ],
      blockSizes: [2]
    };
    const result = generateRandomizationSchema(config);
    const maleCount = result.schema.filter(r => r.stratum['sex'] === 'M').length;
    const femaleCount = result.schema.filter(r => r.stratum['sex'] === 'F').length;
    expect(maleCount).toBe(6);
    expect(femaleCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Subject ID mask
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – subject ID mask', () => {
  it('replaces [SiteID] with the site name', () => {
    const result = generateRandomizationSchema(BASE_CONFIG);
    expect(result.schema[0].subjectId.startsWith('Site1-')).toBe(true);
  });

  it('replaces [001] with a zero-padded counter', () => {
    const result = generateRandomizationSchema(BASE_CONFIG);
    expect(result.schema[0].subjectId).toBe('Site1-001');
    expect(result.schema[3].subjectId).toBe('Site1-004');
  });

  it('supports wider zero-padding via [0001]', () => {
    const config: RandomizationConfig = { ...BASE_CONFIG, subjectIdMask: '[SiteID]-[0001]' };
    const result = generateRandomizationSchema(config);
    expect(result.schema[0].subjectId).toBe('Site1-0001');
    expect(result.schema[3].subjectId).toBe('Site1-0004');
  });

  it('replaces [StratumCode] with the computed stratum code', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      strata: [{ id: 'age', name: 'Age', levels: ['<65'] }],
      stratumCaps: [{ levels: ['<65'], cap: 2 }],
      subjectIdMask: '[SiteID]-[StratumCode]-[001]'
    };
    const result = generateRandomizationSchema(config);
    // stratumCode for '<65' is the first 3 chars uppercased: '<65'
    expect(result.schema[0].subjectId).toContain('-<65-');
  });

  it('resets the site counter per site (each site starts at 001)', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      sites: ['SiteA', 'SiteB'],
      stratumCaps: [{ levels: [], cap: 2 }]
    };
    const result = generateRandomizationSchema(config);
    // SiteA subjects: 001, 002; SiteB subjects: 001, 002
    const siteAIds = result.schema.filter(r => r.site === 'SiteA').map(r => r.subjectId);
    const siteBIds = result.schema.filter(r => r.site === 'SiteB').map(r => r.subjectId);
    expect(siteAIds[0]).toBe('SiteA-001');
    expect(siteBIds[0]).toBe('SiteB-001');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-site behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – multi-site', () => {
  it('generates the correct total subjects across all sites', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      sites: ['S1', 'S2', 'S3'],
      stratumCaps: [{ levels: [], cap: 4 }]
    };
    const result = generateRandomizationSchema(config);
    expect(result.schema.length).toBe(12); // 3 sites × 4 subjects
  });

  it('tags each row with its own site', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      sites: ['Alpha', 'Beta'],
      stratumCaps: [{ levels: [], cap: 2 }]
    };
    const result = generateRandomizationSchema(config);
    const alphaRows = result.schema.filter(r => r.site === 'Alpha');
    const betaRows = result.schema.filter(r => r.site === 'Beta');
    expect(alphaRows.length).toBe(2);
    expect(betaRows.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// New-style token syntax  {SITE}, {STRATUM}, {SEQ:n}, {RND:n}, {CHECKSUM}
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – new token syntax', () => {
  it('{SITE} resolves to the site identifier', () => {
    const config: RandomizationConfig = { ...BASE_CONFIG, subjectIdMask: '{SITE}-001' };
    const result = generateRandomizationSchema(config);
    expect(result.schema[0].subjectId.startsWith('Site1-')).toBe(true);
  });

  it('{SEQ:3} produces a 3-digit zero-padded counter', () => {
    const config: RandomizationConfig = { ...BASE_CONFIG, subjectIdMask: '{SITE}-{SEQ:3}' };
    const result = generateRandomizationSchema(config);
    expect(result.schema[0].subjectId).toBe('Site1-001');
    expect(result.schema[3].subjectId).toBe('Site1-004');
  });

  it('{SEQ:5} produces a 5-digit zero-padded counter', () => {
    const config: RandomizationConfig = { ...BASE_CONFIG, subjectIdMask: '{SEQ:5}' };
    const result = generateRandomizationSchema(config);
    expect(result.schema[0].subjectId).toBe('00001');
    expect(result.schema[3].subjectId).toBe('00004');
  });

  it('{STRATUM} resolves to the computed stratum code', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      strata: [{ id: 'age', name: 'Age', levels: ['<65'] }],
      stratumCaps: [{ levels: ['<65'], cap: 2 }],
      subjectIdMask: '{SITE}-{STRATUM}-{SEQ:3}'
    };
    const result = generateRandomizationSchema(config);
    expect(result.schema[0].subjectId).toContain('-<65-');
  });

  it('{RND:4} generates a 4-character uppercase alphanumeric segment', () => {
    const config: RandomizationConfig = { ...BASE_CONFIG, subjectIdMask: '{SITE}-{RND:4}' };
    const result = generateRandomizationSchema(config);
    const rndPart = result.schema[0].subjectId.replace('Site1-', '');
    expect(rndPart).toHaveLength(4);
    expect(rndPart).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('{RND:n} produces no duplicate subject IDs across the schema', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      sites: ['S1', 'S2'],
      stratumCaps: [{ levels: [], cap: 4 }],
      subjectIdMask: '{SITE}-{RND:8}'
    };
    const result = generateRandomizationSchema(config);
    const ids = result.schema.map(r => r.subjectId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('{CHECKSUM} appends a single check digit computed from the rest of the ID', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      subjectIdMask: '{SITE}-{SEQ:3}-{CHECKSUM}'
    };
    const result = generateRandomizationSchema(config);
    expect(result.schema[0].subjectId).toMatch(/^Site1-001-\d$/);
  });

  it('{CHECKSUM} produces the same digit for the same base string', () => {
    const config: RandomizationConfig = {
      ...BASE_CONFIG,
      subjectIdMask: '{SITE}-{SEQ:3}-{CHECKSUM}'
    };
    const r1 = generateRandomizationSchema(config);
    const r2 = generateRandomizationSchema(config);
    expect(r1.schema[0].subjectId).toBe(r2.schema[0].subjectId);
  });

  it('plain text outside tokens is preserved verbatim', () => {
    const config: RandomizationConfig = { ...BASE_CONFIG, subjectIdMask: 'TRIAL-{SITE}-END' };
    const result = generateRandomizationSchema(config);
    expect(result.schema[0].subjectId).toBe('TRIAL-Site1-END');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MARGINAL_ONLY strategy
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – MARGINAL_ONLY strategy', () => {
  const marginalConfig: RandomizationConfig = {
    ...BASE_CONFIG,
    capStrategy: 'MARGINAL_ONLY',
    strata: [
      {
        id: 'gender',
        name: 'Gender',
        levels: ['Male', 'Female'],
        levelDetails: [
          { name: 'Male', marginalCap: 6 },
          { name: 'Female', marginalCap: 4 }
        ]
      }
    ],
    stratumCaps: [] // not used in MARGINAL_ONLY
  };

  it('generates subjects without exceeding any marginal cap', () => {
    const result = generateRandomizationSchema(marginalConfig);
    const maleCount = result.schema.filter(r => r.stratum['gender'] === 'Male').length;
    const femaleCount = result.schema.filter(r => r.stratum['gender'] === 'Female').length;
    expect(maleCount).toBeLessThanOrEqual(6);
    expect(femaleCount).toBeLessThanOrEqual(4);
  });

  it('stops generating once all marginal caps are reached', () => {
    const result = generateRandomizationSchema(marginalConfig);
    // Total is bounded by the sum of all marginal caps.
    expect(result.schema.length).toBeGreaterThan(0);
    expect(result.schema.length).toBeLessThanOrEqual(10); // 6 + 4 = 10 theoretical max
  });

  it('produces reproducible output with the same seed', () => {
    const r1 = generateRandomizationSchema(marginalConfig);
    const r2 = generateRandomizationSchema(marginalConfig);
    expect(r1.schema.map(r => r.treatmentArmId)).toEqual(r2.schema.map(r => r.treatmentArmId));
  });

  it('correctly tags each row with the assigned stratum combination', () => {
    const result = generateRandomizationSchema(marginalConfig);
    result.schema.forEach(row => {
      expect(['Male', 'Female']).toContain(row.stratum['gender']);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchical Block Strategy Engine
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRandomizationSchema – hierarchical block strategy', () => {
  const BASE_2_ARM: RandomizationConfig = {
    protocolId: 'HBS-001',
    studyName: 'Block Strategy Test',
    phase: 'Phase II',
    arms: [
      { id: 'A', name: 'Active', ratio: 1 },
      { id: 'B', name: 'Placebo', ratio: 1 }
    ],
    sites: ['Site1'],
    strata: [],
    blockSizes: [4],
    stratumCaps: [{ levels: [], cap: 12 }],
    seed: 'hbs_seed',
    subjectIdMask: '[SiteID]-[001]'
  };

  describe('FIXED_SEQUENCE – global strategy', () => {
    it('uses sizes in order and cycles when exhausted', () => {
      const config: RandomizationConfig = {
        ...BASE_2_ARM,
        globalBlockStrategy: { selectionType: 'FIXED_SEQUENCE', sizes: [4, 6] }
      };
      const result = generateRandomizationSchema(config);
      // 12-subject cap with [4, 6] sequence: block 1=4, block 2=6, block 3=4 (cycle) → 14 planned but capped at 12
      // Verify block sizes follow the sequence pattern
      const blockSizes = result.schema.reduce<Map<number, number>>((acc, row) => {
        acc.set(row.blockNumber, row.blockSize);
        return acc;
      }, new Map());
      const sizes = [...blockSizes.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
      expect(sizes[0]).toBe(4);
      expect(sizes[1]).toBe(6);
      if (sizes.length > 2) {
        expect(sizes[2]).toBe(4); // cycles back to start
      }
    });

    it('is reproducible with the same seed', () => {
      const config: RandomizationConfig = {
        ...BASE_2_ARM,
        globalBlockStrategy: { selectionType: 'FIXED_SEQUENCE', sizes: [4, 6] }
      };
      const r1 = generateRandomizationSchema(config);
      const r2 = generateRandomizationSchema(config);
      expect(r1.schema.map(r => r.treatmentArmId)).toEqual(r2.schema.map(r => r.treatmentArmId));
    });
  });

  describe('RANDOM_POOL with limits – global strategy', () => {
    it('respects per-size usage limits by excluding exhausted sizes', () => {
      // Only allow size-4 blocks twice; size-6 is unlimited
      const config: RandomizationConfig = {
        ...BASE_2_ARM,
        stratumCaps: [{ levels: [], cap: 16 }],
        globalBlockStrategy: {
          selectionType: 'RANDOM_POOL',
          sizes: [4, 6],
          limits: { '4': 2 }
        }
      };
      const result = generateRandomizationSchema(config);
      // Count how many blocks of size 4 were generated
      const blockSizeMap = new Map<number, number>();
      const seen = new Set<number>();
      for (const row of result.schema) {
        if (!seen.has(row.blockNumber)) {
          seen.add(row.blockNumber);
          blockSizeMap.set(row.blockSize, (blockSizeMap.get(row.blockSize) ?? 0) + 1);
        }
      }
      expect(blockSizeMap.get(4) ?? 0).toBeLessThanOrEqual(2);
    });

    it('falls back to full pool when all sizes are exhausted by limits', () => {
      // Limit size-4 to 0 – should fall back to the full pool
      const config: RandomizationConfig = {
        ...BASE_2_ARM,
        globalBlockStrategy: {
          selectionType: 'RANDOM_POOL',
          sizes: [4, 6],
          limits: { '4': 0, '6': 0 }
        }
      };
      // Should not throw even when all limits are 0 (soft-cap fallback)
      expect(() => generateRandomizationSchema(config)).not.toThrow();
    });
  });

  describe('Site block override', () => {
    it('uses the site-specific rule for the targeted site', () => {
      const config: RandomizationConfig = {
        ...BASE_2_ARM,
        sites: ['Site1', 'Site2'],
        stratumCaps: [{ levels: [], cap: 4 }],
        globalBlockStrategy: { selectionType: 'RANDOM_POOL', sizes: [4] },
        siteBlockOverrides: {
          'Site2': { selectionType: 'FIXED_SEQUENCE', sizes: [6] }
        }
      };
      const result = generateRandomizationSchema(config);
      const site2Rows = result.schema.filter(r => r.site === 'Site2');
      site2Rows.forEach(r => expect(r.blockSize).toBe(6));
    });

    it('falls back to global strategy when no site override matches', () => {
      const config: RandomizationConfig = {
        ...BASE_2_ARM,
        globalBlockStrategy: { selectionType: 'FIXED_SEQUENCE', sizes: [4] },
        siteBlockOverrides: {
          'NonExistentSite': { selectionType: 'FIXED_SEQUENCE', sizes: [6] }
        }
      };
      const result = generateRandomizationSchema(config);
      result.schema.forEach(r => expect(r.blockSize).toBe(4));
    });
  });

  describe('Stratum block override', () => {
    it('uses the stratum-specific rule (higher priority than site override)', () => {
      const config: RandomizationConfig = {
        protocolId: 'HBS-002',
        studyName: 'Stratum Override Test',
        phase: 'Phase II',
        arms: [
          { id: 'A', name: 'Active', ratio: 1 },
          { id: 'B', name: 'Placebo', ratio: 1 }
        ],
        sites: ['Site1'],
        strata: [{ id: 'age', name: 'Age', levels: ['<65', '>=65'] }],
        blockSizes: [4],
        stratumCaps: [
          { levels: ['<65'], cap: 8 },
          { levels: ['>=65'], cap: 8 }
        ],
        seed: 'strat_override',
        subjectIdMask: '[SiteID]-[001]',
        // computeStratumCode() uses the first 3 characters uppercased:
        //  '<65'  → substring(0,3).toUpperCase() = '<65'
        //  '>=65' → substring(0,3).toUpperCase() = '>=6'
        stratumBlockOverrides: {
          '<65': { selectionType: 'FIXED_SEQUENCE', sizes: [4] },
          '>=6': { selectionType: 'FIXED_SEQUENCE', sizes: [4] }
        },
        siteBlockOverrides: {
          'Site1': { selectionType: 'FIXED_SEQUENCE', sizes: [8] }  // should be overridden by stratum rule
        }
      };
      const result = generateRandomizationSchema(config);
      // All rows should use size 4 (stratum override beats site override)
      result.schema.forEach(r => expect(r.blockSize).toBe(4));
    });
  });

  describe('Validation', () => {
    it('throws when globalBlockStrategy has a size not divisible by totalRatio', () => {
      const config: RandomizationConfig = {
        ...BASE_2_ARM,
        globalBlockStrategy: { selectionType: 'RANDOM_POOL', sizes: [3] } // 3 not divisible by 2
      };
      expect(() => generateRandomizationSchema(config)).toThrow(/not a multiple/);
    });

    it('throws when siteBlockOverrides has an invalid size', () => {
      const config: RandomizationConfig = {
        ...BASE_2_ARM,
        siteBlockOverrides: {
          'Site1': { selectionType: 'RANDOM_POOL', sizes: [5] } // 5 not divisible by 2
        }
      };
      expect(() => generateRandomizationSchema(config)).toThrow(/not a multiple/);
    });
  });
});

