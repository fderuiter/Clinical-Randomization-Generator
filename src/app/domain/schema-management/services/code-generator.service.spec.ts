import { TestBed } from '@angular/core/testing';
import { CodeGeneratorService } from './code-generator.service';
import { RandomizationConfig } from '../../core/models/randomization.model';
import {
  ConfigurationValidationError,
} from '../errors/code-generation-errors';

describe('CodeGeneratorService', () => {
  let service: CodeGeneratorService;

  /** Minimal config: no strata, no caps, single arm */
  let minimalConfig: RandomizationConfig;

  /** Full config: 2 strata, 4 caps, 2 arms with different ratios */
  let fullConfig: RandomizationConfig;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CodeGeneratorService);

    minimalConfig = {
      protocolId: 'TEST-123',
      studyName: 'Test Study',
      phase: 'Phase II',
      arms: [{ id: 'A', name: 'Active', ratio: 1 }],
      sites: ['Site1', 'Site2'],
      strata: [],
      blockSizes: [2, 4],
      stratumCaps: [],
      seed: 'test_seed',
      subjectIdMask: '[SiteID]-[001]'
    };

    fullConfig = {
      protocolId: 'FULL-456',
      studyName: 'Full Study',
      phase: 'Phase III',
      arms: [
        { id: '1', name: 'Treatment', ratio: 2 },
        { id: '2', name: 'Placebo', ratio: 1 }
      ],
      sites: ['SiteA', 'SiteB'],
      strata: [
        { id: 'sex', name: 'Sex', levels: ['Male', 'Female'] },
        { id: 'age', name: 'Age Group', levels: ['Young', 'Old'] }
      ],
      blockSizes: [3, 6],
      stratumCaps: [
        { levels: ['Male', 'Young'], cap: 12 },
        { levels: ['Male', 'Old'], cap: 9 },
        { levels: ['Female', 'Young'], cap: 15 },
        { levels: ['Female', 'Old'], cap: 6 }
      ],
      seed: 'full_seed',
      subjectIdMask: '[SiteID]-[001]'
    };
  });

  // ---------------------------------------------------------------------------
  // R code generation
  // ---------------------------------------------------------------------------
  describe('generateR()', () => {
    describe('header and parameters', () => {
      it('should embed protocol, study, and app version in the header', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('Protocol: FULL-456');
        expect(code).toContain('Study: Full Study');
        expect(code).toContain('App Version:');
        expect(code).toContain('Generated At:');
        expect(code).toContain('PRNG Algorithm: Mersenne-Twister');
      });

      it('should fall back to "Unknown" when protocolId/studyName are blank', () => {
        const code = service.generateR({ ...minimalConfig, protocolId: '', studyName: '' });
        expect(code).toContain('Protocol: Unknown');
        expect(code).toContain('Study: Unknown');
      });

      it('should embed sites correctly', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('sites <- c("SiteA", "SiteB")');
      });

      it('should embed block sizes correctly', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('block_sizes <- c(3, 6)');
      });

      it('should embed treatment arms and ratios correctly', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('arms <- c("Treatment", "Placebo")');
        expect(code).toContain('ratios <- c(2, 1)');
      });

      it('should call set.seed() with a numeric argument derived from the seed string', () => {
        const code = service.generateR(fullConfig);
        const match = code.match(/set\.seed\((\d+)\)/);
        expect(match).not.toBeNull();
        // The hash should be a non-negative integer
        expect(Number(match![1])).toBeGreaterThanOrEqual(0);
      });
    });

    describe('strata and cap handling', () => {
      it('should generate level vectors for each stratum', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('sex_levels <- c("Male", "Female")');
        expect(code).toContain('age_levels <- c("Young", "Old")');
      });

      it('should use stringsAsFactors = FALSE in expand.grid() to prevent factor coercion', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('stringsAsFactors = FALSE');
      });

      it('should use seq_len(nrow(...)) instead of 1:nrow(...) to avoid the 1:0 R gotcha', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('for (i in seq_len(nrow(strata_grid)))');
        expect(code).not.toContain('1:nrow(strata_grid)');
      });

      it('should use paste(unlist(stratum), ...) so factor columns do not produce integer codes', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('stratum_key <- paste(unlist(stratum), collapse="_")');
      });

      it('should embed named stratum caps matching the levels joined by underscore', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('"Male_Young" = 12');
        expect(code).toContain('"Male_Old" = 9');
        expect(code).toContain('"Female_Young" = 15');
        expect(code).toContain('"Female_Old" = 6');
      });

      it('should add the no-strata guard after expand.grid()', () => {
        // The guard must be present whether or not strata are defined
        const codeWithStrata = service.generateR(fullConfig);
        const codeNoStrata = service.generateR(minimalConfig);
        const guard = 'if (nrow(strata_grid) == 0) strata_grid <- data.frame(row.names = 1L)';
        expect(codeWithStrata).toContain(guard);
        expect(codeNoStrata).toContain(guard);
      });
    });

    describe('structural correctness', () => {
      it('should include the block math failsafe', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('block_sizes %% total_ratio != 0');
        expect(code).toContain('stop(');
      });

      it('should include a while loop driven by max_subjects_per_stratum', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('while (stratum_subject_count < max_subjects_per_stratum)');
      });

      it('should build rows using data.frame and cbind with stratum', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('row <- cbind(row, stratum)');
        expect(code).toContain('schema <- do.call(rbind, schema_list)');
      });

      it('should include QC checks for treatment, site, and block size', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('QC Check: Overall Allocation');
        expect(code).toContain('table(schema$Treatment)');
        expect(code).toContain('QC Check: Site-Level Balance');
        expect(code).toContain('table(schema$Site, schema$Treatment)');
        expect(code).toContain('QC Check: Dynamic Block Utilization');
        expect(code).toContain('table(schema$BlockSize)');
      });

      it('should wrap QC checks in an nrow(schema) > 0 guard', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('if (nrow(schema) > 0)');
        expect(code).toContain('No rows generated; skipping QC tables.');
      });

      it('should include the null/empty schema guard with typed empty data.frame columns', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('is.null(schema) || nrow(schema) == 0');
        expect(code).toContain('SubjectID = character(0)');
        expect(code).toContain('Site = character(0)');
        expect(code).toContain('Treatment = character(0)');
      });

      it('should handle ncol(stratum) == 0 for unstratified configs', () => {
        const code = service.generateR(fullConfig);
        expect(code).toContain('if (ncol(stratum) == 0)');
        expect(code).toContain('stratum_key <- ""');
      });
    });

    describe('edge cases', () => {
      it('should still include stringsAsFactors and seq_len when strata is empty', () => {
        const code = service.generateR(minimalConfig);
        expect(code).toContain('stringsAsFactors = FALSE');
        expect(code).toContain('for (i in seq_len(nrow(strata_grid)))');
      });

      it('should handle empty sites array', () => {
        const code = service.generateR({ ...minimalConfig, sites: [] });
        expect(code).toContain('sites <- c()');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Python code generation
  // ---------------------------------------------------------------------------
  describe('generatePython()', () => {
    describe('header and parameters', () => {
      it('should embed protocol, study, and version in the header', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('Protocol: FULL-456');
        expect(code).toContain('Study: Full Study');
        expect(code).toContain('App Version:');
        expect(code).toContain('Generated At:');
        expect(code).toContain('PRNG Algorithm: PCG64');
      });

      it('should import required libraries', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('import numpy as np');
        expect(code).toContain('import itertools');
        expect(code).toContain('import pandas as pd');
      });

      it('should embed sites as a Python list', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('sites = ["SiteA", "SiteB"]');
      });

      it('should embed block sizes as a Python list', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('block_sizes = [3, 6]');
      });

      it('should embed arms with name and ratio dicts', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('{"name": "Treatment", "ratio": 2}');
        expect(code).toContain('{"name": "Placebo", "ratio": 1}');
      });

      it('should call np.random.default_rng with a numeric seed', () => {
        const code = service.generatePython(fullConfig);
        const match = code.match(/np\.random\.default_rng\((\d+)\)/);
        expect(match).not.toBeNull();
        expect(Number(match![1])).toBeGreaterThanOrEqual(0);
      });
    });

    describe('strata and cap handling', () => {
      it('should generate strata_levels as nested Python lists', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('["Male", "Female"]');
        expect(code).toContain('["Young", "Old"]');
      });

      it('should use itertools.product to produce all strata combinations', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('strata_combinations = list(itertools.product(*strata_levels))');
      });

      it('should embed cap dictionary with tuple keys matching strata levels', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('("Male", "Young"): 12');
        expect(code).toContain('("Male", "Old"): 9');
        expect(code).toContain('("Female", "Young"): 15');
        expect(code).toContain('("Female", "Old"): 6');
      });

      it('should use stratum_caps.get(combo, 0) for per-stratum cap lookup', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('stratum_caps.get(combo, 0)');
      });

      it('should fall back to (): 0 when no caps are defined', () => {
        const code = service.generatePython(minimalConfig);
        expect(code).toContain('(): 0');
      });
    });

    describe('structural correctness', () => {
      it('should include the block math failsafe', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('any(bs % total_ratio != 0 for bs in block_sizes)');
        expect(code).toContain('raise ValueError(');
      });

      it('should use rng.choice for block size selection and rng.shuffle for shuffling', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('rng.choice(block_sizes)');
        expect(code).toContain('rng.shuffle(block)');
      });

      it('should format subject IDs using f-string zero-padding', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('site_subject_count:03d');
      });

      it('should build a pandas DataFrame and include QC checks', () => {
        const code = service.generatePython(fullConfig);
        expect(code).toContain('df = pd.DataFrame(schema)');
        expect(code).toContain("df['Treatment'].value_counts()");
        expect(code).toContain("pd.crosstab(df['Site'], df['Treatment'])");
        expect(code).toContain("df['BlockSize'].value_counts()");
      });
    });

    describe('edge cases', () => {
      it('should produce empty strata_levels and strata_names when no strata defined', () => {
        const code = service.generatePython(minimalConfig);
        expect(code).toMatch(/strata_levels = \[\s*\]/);
        expect(code).toContain('strata_names = []');
      });

      it('should handle empty sites', () => {
        const code = service.generatePython({ ...minimalConfig, sites: [] });
        expect(code).toContain('sites = []');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // SAS code generation
  // ---------------------------------------------------------------------------
  describe('generateSas()', () => {
    describe('header and parameters', () => {
      it('should embed protocol, study, and version in the header', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('Protocol: FULL-456');
        expect(code).toContain('Study: Full Study');
        expect(code).toContain('App Version:');
        expect(code).toContain('Generated At:');
        expect(code).toContain('PRNG Algorithm: Mersenne Twister');
      });

      it('should declare %let seed with a numeric value', () => {
        const code = service.generateSas(fullConfig);
        const match = code.match(/%let seed = (\d+);/);
        expect(match).not.toBeNull();
        expect(Number(match![1])).toBeGreaterThanOrEqual(0);
      });

      it('should declare %let sites with quoted site names', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('%let sites = "SiteA" "SiteB";');
      });

      it('should declare %let arms with quoted arm names', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('%let arms = "Treatment" "Placebo";');
      });

      it('should declare %let ratios with arm ratios', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('%let ratios = 2 1;');
      });

      it('should declare %let block_sizes with block sizes', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('%let block_sizes = 3 6;');
      });
    });

    describe('strata and cap handling', () => {
      it('should declare %let strata_factors with quoted stratum IDs', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('%let strata_factors = "sex" "age";');
      });

      it('should declare level macros for each stratum', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('%let sex_levels = "Male" "Female";');
        expect(code).toContain('%let age_levels = "Young" "Old";');
      });

      it('should build _caps dataset with stratum column values and cap', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('sex = "Male";');
        expect(code).toContain('age = "Young";');
        expect(code).toContain('max_subjects_per_stratum = 12;');
        expect(code).toContain('max_subjects_per_stratum = 9;');
        expect(code).toContain('max_subjects_per_stratum = 15;');
        expect(code).toContain('max_subjects_per_stratum = 6;');
      });

      it('should use proc sql with cross join for strata design matrix', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('cross join _strata_1');
        expect(code).toContain('cross join _strata_2');
        expect(code).toContain('left join _caps caps on 1=1');
      });
    });

    describe('structural correctness', () => {
      it('should include the block math failsafe macro', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('BLOCK_MATH_ERROR');
        expect(code).toContain('%abort cancel');
      });

      it('should initialise the PRNG with call streaminit(&seed.)', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('call streaminit(&seed.)');
      });

      it('should use rand("uniform") for dynamic block selection', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain("rand('uniform')");
      });

      it('should include proc sort and final_schema output dataset', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('proc sort data=_blocks;');
        expect(code).toContain('data final_schema;');
      });

      it('should include QC proc freq steps', () => {
        const code = service.generateSas(fullConfig);
        expect(code).toContain('proc freq data=final_schema;');
        expect(code).toContain('tables Treatment / nocum;');
        expect(code).toContain('tables Site * Treatment / nocol nopercent;');
        expect(code).toContain('tables block_size / nocum;');
      });
    });

    describe('edge cases', () => {
      it('should omit strata_factors declaration when no strata defined', () => {
        const code = service.generateSas(minimalConfig);
        expect(code).not.toContain('%let strata_factors');
        expect(code).not.toContain('cross join _strata_');
      });

      it('should still produce a complete schema with no strata', () => {
        const code = service.generateSas(minimalConfig);
        expect(code).toContain('data final_schema;');
        expect(code).toContain('proc freq data=final_schema;');
      });

      it('should default caps to 0 when no caps are provided', () => {
        const code = service.generateSas(minimalConfig);
        expect(code).toContain('max_subjects_per_stratum = 0; output;');
      });

      it('should handle empty sites', () => {
        const code = service.generateSas({ ...minimalConfig, sites: [] });
        expect(code).toContain('%let sites = ;');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-language consistency
  // ---------------------------------------------------------------------------
  describe('cross-language consistency', () => {
    it('should embed the same protocol ID in all three languages', () => {
      const r = service.generateR(fullConfig);
      const py = service.generatePython(fullConfig);
      const sas = service.generateSas(fullConfig);
      expect(r).toContain('FULL-456');
      expect(py).toContain('FULL-456');
      expect(sas).toContain('FULL-456');
    });

    it('should derive a non-negative integer seed hash consistently', () => {
      // Call each generator twice - the hash for the same seed string must be identical
      const r1 = service.generateR(fullConfig).match(/set\.seed\((\d+)\)/)![1];
      const r2 = service.generateR(fullConfig).match(/set\.seed\((\d+)\)/)![1];
      expect(r1).toBe(r2);

      const py1 = service.generatePython(fullConfig).match(/default_rng\((\d+)\)/)![1];
      const py2 = service.generatePython(fullConfig).match(/default_rng\((\d+)\)/)![1];
      expect(py1).toBe(py2);

      const sas1 = service.generateSas(fullConfig).match(/%let seed = (\d+);/)![1];
      const sas2 = service.generateSas(fullConfig).match(/%let seed = (\d+);/)![1];
      expect(sas1).toBe(sas2);
    });

    it('should embed the same seed hash value in R and Python for the same config', () => {
      const rSeed = service.generateR(fullConfig).match(/set\.seed\((\d+)\)/)![1];
      const pySeed = service.generatePython(fullConfig).match(/default_rng\((\d+)\)/)![1];
      const sasSeed = service.generateSas(fullConfig).match(/%let seed = (\d+);/)![1];
      expect(rSeed).toBe(pySeed);
      expect(rSeed).toBe(sasSeed);
    });

    it('should produce a different seed hash when the seed string changes', () => {
      const configA = { ...fullConfig, seed: 'seedA' };
      const configB = { ...fullConfig, seed: 'seedB' };
      const hashA = service.generateR(configA).match(/set\.seed\((\d+)\)/)![1];
      const hashB = service.generateR(configB).match(/set\.seed\((\d+)\)/)![1];
      expect(hashA).not.toBe(hashB);
    });

    it('should produce a seed hash within the safe set.seed() range (0..2147483646)', () => {
      // R's set.seed() / SAS call streaminit() accept 0..2^31-2; Python SeedSequence also
      // accepts non-negative integers. Math.abs(-2147483648) === 2147483648, which exceeds
      // the 31-bit limit, so we use (hash >>> 0) % 2147483647 instead.
      const seeds = ['abc', 'seedA', 'test123', fullConfig.seed!];
      for (const s of seeds) {
        const cfg = { ...fullConfig, seed: s };
        const rSeed = Number(service.generateR(cfg).match(/set\.seed\((\d+)\)/)![1]);
        expect(rSeed).toBeGreaterThanOrEqual(0);
        expect(rSeed).toBeLessThan(2147483647);
      }
    });

    it('should include a Generated At timestamp in all three outputs', () => {
      const r = service.generateR(fullConfig);
      const py = service.generatePython(fullConfig);
      const sas = service.generateSas(fullConfig);
      // ISO 8601 date prefix
      expect(r).toMatch(/Generated At: \d{4}-\d{2}-\d{2}/);
      expect(py).toMatch(/Generated At: \d{4}-\d{2}-\d{2}/);
      expect(sas).toMatch(/Generated At: \d{4}-\d{2}-\d{2}/);
    });
  });

  // ---------------------------------------------------------------------------
  // generate() dispatcher and error hierarchy
  // ---------------------------------------------------------------------------
  describe('generate()', () => {
    it('should delegate to generateR for language "R"', () => {
      const code = service.generate('R', minimalConfig);
      expect(code).toContain('set.seed(');
    });

    it('should delegate to generatePython for language "Python"', () => {
      const code = service.generate('Python', minimalConfig);
      expect(code).toContain('np.random.default_rng(');
    });

    it('should delegate to generateSas for language "SAS"', () => {
      const code = service.generate('SAS', minimalConfig);
      expect(code).toContain('%let seed =');
    });
  });

  describe('ConfigurationValidationError', () => {
    it('should throw ConfigurationValidationError when arms array is empty', () => {
      const noArmsConfig = { ...minimalConfig, arms: [] };
      expect(() => service.generate('R', noArmsConfig)).toThrow(ConfigurationValidationError);
    });

    it('should throw ConfigurationValidationError when blockSizes array is empty', () => {
      const noBlocksConfig = { ...minimalConfig, blockSizes: [] };
      expect(() => service.generate('R', noBlocksConfig)).toThrow(ConfigurationValidationError);
    });
  });

  describe('empty seed', () => {
    it('should generate code successfully when seed is an empty string', () => {
      const noSeedConfig = { ...minimalConfig, seed: '' };
      expect(() => service.generate('R', noSeedConfig)).not.toThrow();
    });

    it('should generate code successfully when seed is whitespace only', () => {
      const noSeedConfig = { ...minimalConfig, seed: '   ' };
      expect(() => service.generate('Python', noSeedConfig)).not.toThrow();
    });
  });
});
