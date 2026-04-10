import { TestBed } from '@angular/core/testing';
import { MethodologySpecificationService } from './methodology-specification.service';
import { RandomizationConfig } from '../../core/models/randomization.model';

describe('MethodologySpecificationService', () => {
  let service: MethodologySpecificationService;

  /** Minimal unstratified config */
  const minimalConfig: RandomizationConfig = {
    protocolId: 'MIN-001',
    studyName: 'Minimal Study',
    phase: 'Phase I',
    arms: [{ id: 'A', name: 'Active', ratio: 1 }],
    sites: ['Site1'],
    strata: [],
    blockSizes: [4],
    stratumCaps: [],
    seed: 'seed_min',
    subjectIdMask: '[SiteID]-[001]',
  };

  /** Stratified config with 2 factors and MANUAL_MATRIX cap */
  const stratifiedConfig: RandomizationConfig = {
    protocolId: 'STR-002',
    studyName: 'Stratified Study',
    phase: 'Phase II',
    arms: [
      { id: '1', name: 'Treatment', ratio: 2 },
      { id: '2', name: 'Placebo', ratio: 1 },
    ],
    sites: ['SiteA', 'SiteB'],
    strata: [
      { id: 'sex', name: 'Sex', levels: ['Male', 'Female'] },
      { id: 'age', name: 'Age Group', levels: ['Young', 'Old'] },
    ],
    blockSizes: [3, 6],
    stratumCaps: [
      { levels: ['Male', 'Young'], cap: 12 },
      { levels: ['Male', 'Old'], cap: 9 },
      { levels: ['Female', 'Young'], cap: 15 },
      { levels: ['Female', 'Old'], cap: 6 },
    ],
    seed: 'seed_strat',
    subjectIdMask: '[SiteID]-[001]',
  };

  /** Config with PROPORTIONAL cap strategy */
  const proportionalConfig: RandomizationConfig = {
    ...stratifiedConfig,
    capStrategy: 'PROPORTIONAL',
    globalCap: 100,
    strata: [
      {
        id: 'sex', name: 'Sex', levels: ['Male', 'Female'],
        levelDetails: [
          { name: 'Male', targetPercentage: 60 },
          { name: 'Female', targetPercentage: 40 },
        ],
      },
    ],
  };

  /** Config with MARGINAL_ONLY cap strategy */
  const marginalConfig: RandomizationConfig = {
    protocolId: 'MARG-003',
    studyName: 'Marginal Study',
    phase: 'Phase III',
    arms: [
      { id: '1', name: 'Drug', ratio: 1 },
      { id: '2', name: 'Placebo', ratio: 1 },
    ],
    sites: ['S1'],
    strata: [
      {
        id: 'sex', name: 'Sex', levels: ['Male', 'Female'],
        levelDetails: [
          { name: 'Male', marginalCap: 30 },
          { name: 'Female', marginalCap: 30 },
        ],
      },
      {
        id: 'age', name: 'Age Group', levels: ['Young', 'Old'],
        levelDetails: [
          { name: 'Young', marginalCap: 20 },
          { name: 'Old', marginalCap: 40 },
        ],
      },
    ],
    blockSizes: [2, 4],
    stratumCaps: [],
    seed: 'marg_seed',
    subjectIdMask: '[SiteID]-[001]',
    capStrategy: 'MARGINAL_ONLY',
  };

  /** Config with globalBlockStrategy RANDOM_POOL */
  const randomPoolConfig: RandomizationConfig = {
    ...stratifiedConfig,
    globalBlockStrategy: { selectionType: 'RANDOM_POOL', sizes: [4, 8] },
  };

  /** Config with globalBlockStrategy FIXED_SEQUENCE */
  const fixedSequenceConfig: RandomizationConfig = {
    ...stratifiedConfig,
    globalBlockStrategy: { selectionType: 'FIXED_SEQUENCE', sizes: [4, 8, 12] },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MethodologySpecificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // generateNarrative() – algorithm description
  // ---------------------------------------------------------------------------
  describe('generateNarrative() – algorithm description', () => {
    it('should mention "stratified block randomization" when strata are defined', () => {
      const text = service.generateNarrative(stratifiedConfig);
      expect(text).toContain('stratified block randomization');
    });

    it('should mention "block randomization" (without "stratified") for unstratified configs', () => {
      const text = service.generateNarrative(minimalConfig);
      expect(text).toContain('block randomization');
      expect(text).not.toContain('stratified block randomization');
    });

    it('should mention Fisher-Yates shuffle', () => {
      expect(service.generateNarrative(stratifiedConfig)).toContain('Fisher-Yates');
      expect(service.generateNarrative(minimalConfig)).toContain('Fisher-Yates');
    });

    it('should mention PRNG', () => {
      expect(service.generateNarrative(stratifiedConfig)).toContain('PRNG');
    });
  });

  // ---------------------------------------------------------------------------
  // generateNarrative() – block size strategy
  // ---------------------------------------------------------------------------
  describe('generateNarrative() – block size strategy', () => {
    it('should describe RANDOM_POOL globalBlockStrategy', () => {
      const text = service.generateNarrative(randomPoolConfig);
      expect(text).toContain('RANDOM_POOL');
      expect(text).toContain('[4, 8]');
    });

    it('should describe FIXED_SEQUENCE globalBlockStrategy', () => {
      const text = service.generateNarrative(fixedSequenceConfig);
      expect(text).toContain('FIXED_SEQUENCE');
      expect(text).toContain('[4, 8, 12]');
    });

    it('should describe a single flat block size as fixed', () => {
      const text = service.generateNarrative(minimalConfig);
      expect(text).toContain('fixed block size of 4');
    });

    it('should describe multiple flat block sizes as randomly selected', () => {
      const text = service.generateNarrative(stratifiedConfig);
      expect(text).toContain('[3, 6]');
      expect(text).toContain('randomly selected from the pool');
    });

    it('should include block-size usage limits when defined', () => {
      const cfg: RandomizationConfig = {
        ...stratifiedConfig,
        globalBlockStrategy: {
          selectionType: 'RANDOM_POOL',
          sizes: [4, 8],
          limits: { '4': 3, '8': 5 },
        },
      };
      const text = service.generateNarrative(cfg);
      expect(text).toContain('usage limits');
      expect(text).toContain('size 4 (max 3 uses)');
      expect(text).toContain('size 8 (max 5 uses)');
    });
  });

  // ---------------------------------------------------------------------------
  // generateNarrative() – stratification
  // ---------------------------------------------------------------------------
  describe('generateNarrative() – stratification', () => {
    it('should list all stratification factors and levels', () => {
      const text = service.generateNarrative(stratifiedConfig);
      expect(text).toContain('Sex');
      expect(text).toContain('Male, Female');
      expect(text).toContain('Age Group');
      expect(text).toContain('Young, Old');
    });

    it('should state the number of factors', () => {
      const text = service.generateNarrative(stratifiedConfig);
      expect(text).toContain('Stratification Factors (2)');
    });

    it('should state no stratification when strata is empty', () => {
      const text = service.generateNarrative(minimalConfig);
      expect(text).toContain('Stratification Factors: None');
    });
  });

  // ---------------------------------------------------------------------------
  // generateNarrative() – cap strategy
  // ---------------------------------------------------------------------------
  describe('generateNarrative() – cap strategy (MANUAL_MATRIX)', () => {
    it('should identify MANUAL_MATRIX strategy', () => {
      const text = service.generateNarrative(stratifiedConfig);
      expect(text).toContain('MANUAL_MATRIX');
    });

    it('should state the number of intersection caps', () => {
      const text = service.generateNarrative(stratifiedConfig);
      expect(text).toContain('4 intersection caps');
    });

    it('should handle singular "cap" for exactly 1 cap', () => {
      const cfg: RandomizationConfig = {
        ...stratifiedConfig,
        stratumCaps: [{ levels: ['Male', 'Young'], cap: 10 }],
      };
      const text = service.generateNarrative(cfg);
      expect(text).toContain('1 intersection cap configured');
    });
  });

  describe('generateNarrative() – cap strategy (PROPORTIONAL)', () => {
    it('should identify PROPORTIONAL strategy', () => {
      const text = service.generateNarrative(proportionalConfig);
      expect(text).toContain('PROPORTIONAL');
    });

    it('should mention LRM', () => {
      const text = service.generateNarrative(proportionalConfig);
      expect(text).toContain('Largest Remainder Method');
    });

    it('should state the global cap when provided', () => {
      const text = service.generateNarrative(proportionalConfig);
      expect(text).toContain('100');
    });

    it('should list target percentages from levelDetails', () => {
      const text = service.generateNarrative(proportionalConfig);
      expect(text).toContain('Male = 60%');
      expect(text).toContain('Female = 40%');
    });
  });

  describe('generateNarrative() – cap strategy (MARGINAL_ONLY)', () => {
    it('should identify MARGINAL_ONLY strategy', () => {
      const text = service.generateNarrative(marginalConfig);
      expect(text).toContain('MARGINAL_ONLY');
    });

    it('should describe active pool pruning', () => {
      const text = service.generateNarrative(marginalConfig);
      expect(text).toContain('active allocation pool');
    });

    it('should list marginal cap values for each factor level', () => {
      const text = service.generateNarrative(marginalConfig);
      expect(text).toContain('Male = 30');
      expect(text).toContain('Female = 30');
      expect(text).toContain('Young = 20');
      expect(text).toContain('Old = 40');
    });
  });

  // ---------------------------------------------------------------------------
  // generateNarrative() – reproducibility paragraph
  // ---------------------------------------------------------------------------
  describe('generateNarrative() – reproducibility', () => {
    it('should mention the seed value', () => {
      const text = service.generateNarrative(stratifiedConfig);
      expect(text).toContain('seed_strat');
    });

    it('should state that the seed guarantees reproducibility', () => {
      const text = service.generateNarrative(stratifiedConfig);
      expect(text).toContain('Reproducibility');
    });

    it('should handle an empty seed string gracefully', () => {
      const cfg = { ...minimalConfig, seed: '' };
      expect(() => service.generateNarrative(cfg)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // formatAsLineComments()
  // ---------------------------------------------------------------------------
  describe('formatAsLineComments()', () => {
    it('should prefix every non-blank line with the given prefix', () => {
      const narrative = 'Line one.\n\nLine two.';
      const result = service.formatAsLineComments(narrative, '#');
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line.startsWith('#')).toBe(true);
      }
    });

    it('should include a section header', () => {
      const result = service.formatAsLineComments('Test', '#');
      expect(result).toContain('RANDOMIZATION PLAN & SPECIFICATIONS');
    });

    it('should default to "#" when no prefix is supplied', () => {
      const result = service.formatAsLineComments('Test');
      expect(result.split('\n')[0].startsWith('#')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // formatAsSasComment()
  // ---------------------------------------------------------------------------
  describe('formatAsSasComment()', () => {
    it('should wrap every line in /* ... */', () => {
      const narrative = 'Line one.\n\nLine two.';
      const result = service.formatAsSasComment(narrative);
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line.startsWith('/*')).toBe(true);
        expect(line.endsWith('*/')).toBe(true);
      }
    });

    it('should include a section header', () => {
      const result = service.formatAsSasComment('Test');
      expect(result).toContain('RANDOMIZATION PLAN & SPECIFICATIONS');
    });
  });

  // ---------------------------------------------------------------------------
  // formatForCsv()
  // ---------------------------------------------------------------------------
  describe('formatForCsv()', () => {
    it('should prefix every line with "#"', () => {
      const narrative = 'Line one.\n\nLine two.';
      const result = service.formatForCsv(narrative);
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line.startsWith('#')).toBe(true);
      }
    });

    it('should include the section header label', () => {
      const result = service.formatForCsv('Test');
      expect(result).toContain('RANDOMIZATION PLAN & SPECIFICATIONS');
    });
  });
});
