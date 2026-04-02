import { TestBed } from '@angular/core/testing';
import { RandomizationService } from './randomization.service';
import { RandomizationConfig } from '../../models/randomization.model';

describe('RandomizationService', () => {
  let service: RandomizationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RandomizationService);
  });

  it('should generate schema with distinct stratum caps', () => {
    return new Promise<void>((resolve) => {
      const config: RandomizationConfig = {
        protocolId: 'TEST-123',
        studyName: 'Test Study',
        phase: 'Phase 1',
        arms: [
          { id: '1', name: 'Arm A', ratio: 1 },
          { id: '2', name: 'Arm B', ratio: 1 }
        ],
        sites: ['Site1'],
        strata: [
          { id: 'strata1', name: 'Strata 1', levels: ['Low', 'High'] },
          { id: 'strata2', name: 'Strata 2', levels: ['Yes', 'No'] }
        ],
        blockSizes: [2], // Use size 2 to exactly match 1:1 ratio
        stratumCaps: [
          { levels: ['Low', 'Yes'], cap: 2 },  // 1 block
          { levels: ['Low', 'No'], cap: 4 },   // 2 blocks
          { levels: ['High', 'Yes'], cap: 6 }, // 3 blocks
          { levels: ['High', 'No'], cap: 8 }   // 4 blocks
        ],
        seed: 'test_seed',
        subjectIdMask: '[SiteID]-[StratumCode]-[001]'
      };

      service.generateSchema(config).subscribe(result => {
        expect(result).toBeTruthy();
        const schema = result.schema;

        // Count subjects by stratum combination
        const counts = {
          'Low|Yes': 0,
          'Low|No': 0,
          'High|Yes': 0,
          'High|No': 0
        };

        schema.forEach(row => {
          const key = `${row.stratum['strata1']}|${row.stratum['strata2']}`;
          counts[key as keyof typeof counts]++;
        });

        expect(counts['Low|Yes']).toBe(2);
        expect(counts['Low|No']).toBe(4);
        expect(counts['High|Yes']).toBe(6);
        expect(counts['High|No']).toBe(8);

        // Total subjects should be 2+4+6+8 = 20
        expect(schema.length).toBe(20);

        resolve();
      });
    });
  });

  it('should handle block math validation errors', () => {
    return new Promise<void>((resolve, reject) => {
      const config: RandomizationConfig = {
        protocolId: 'TEST-123',
        studyName: 'Test Study',
        phase: 'Phase 1',
        arms: [
          { id: '1', name: 'Arm A', ratio: 1 },
          { id: '2', name: 'Arm B', ratio: 2 } // total ratio 3
        ],
        sites: ['Site1'],
        strata: [],
        blockSizes: [4], // 4 is not a multiple of 3
        stratumCaps: [{ levels: [], cap: 10 }],
        seed: 'test_seed',
        subjectIdMask: '[SiteID]-[StratumCode]-[001]'
      };

      service.generateSchema(config).subscribe({
        next: () => {
          reject(new Error('Should have thrown an error'));
        },
        error: (err) => {
          expect(err.error.error).toBe('Block size 4 is not a multiple of total ratio 3');
          resolve();
        }
      });
    });
  });

  it('should respect treatment ratios within generated blocks', () => {
    return new Promise<void>((resolve) => {
      const config: RandomizationConfig = {
        protocolId: 'TEST-RATIO',
        studyName: 'Ratio Test Study',
        phase: 'Phase 1',
        arms: [
          { id: '1', name: 'Active', ratio: 2 },
          { id: '2', name: 'Placebo', ratio: 1 }
        ],
        sites: ['Site1'],
        strata: [],
        blockSizes: [3],
        stratumCaps: [{ levels: [], cap: 30 }], // 10 blocks
        seed: 'ratio_seed',
        subjectIdMask: '[SiteID]-[001]'
      };

      service.generateSchema(config).subscribe(result => {
        expect(result).toBeTruthy();
        const schema = result.schema;

        const blocks: Record<number, string[]> = {};
        schema.forEach(row => {
          if (!blocks[row.blockNumber]) {
            blocks[row.blockNumber] = [];
          }
          blocks[row.blockNumber].push(row.treatmentArm);
        });

        Object.keys(blocks).forEach(blockNumberStr => {
          const block = blocks[parseInt(blockNumberStr, 10)];
          const activeCount = block.filter(arm => arm === 'Active').length;
          const placeboCount = block.filter(arm => arm === 'Placebo').length;

          expect(activeCount).toBe(2);
          expect(placeboCount).toBe(1);
          expect(block.length).toBe(3);
        });

        resolve();
      });
    });
  });

  it('should exhibit uniform distribution across block permutations', () => {
    return new Promise<void>((resolve) => {
      const config: RandomizationConfig = {
        protocolId: 'TEST-MC',
        studyName: 'Monte Carlo Study',
        phase: 'Phase 1',
        arms: [
          { id: '1', name: 'A', ratio: 1 },
          { id: '2', name: 'B', ratio: 1 }
        ],
        sites: ['Site1'],
        strata: [],
        blockSizes: [2],
        stratumCaps: [{ levels: [], cap: 10000 }], // 5000 blocks
        seed: 'monte_carlo_seed',
        subjectIdMask: '[SiteID]-[001]'
      };

      service.generateSchema(config).subscribe(result => {
        expect(result).toBeTruthy();
        const schema = result.schema;

        const blocks: Record<number, string[]> = {};
        schema.forEach(row => {
          if (!blocks[row.blockNumber]) {
            blocks[row.blockNumber] = [];
          }
          blocks[row.blockNumber].push(row.treatmentArm);
        });

        let abCount = 0;
        let baCount = 0;

        Object.values(blocks).forEach(block => {
          if (block.length === 2) {
            if (block[0] === 'A' && block[1] === 'B') {
              abCount++;
            } else if (block[0] === 'B' && block[1] === 'A') {
              baCount++;
            }
          }
        });

        const totalValidBlocks = abCount + baCount;
        expect(totalValidBlocks).toBe(5000);

        const expectedCount = totalValidBlocks / 2;
        const marginOfError = totalValidBlocks * 0.05; // 5%

        expect(abCount).toBeGreaterThan(expectedCount - marginOfError);
        expect(abCount).toBeLessThan(expectedCount + marginOfError);
        expect(baCount).toBeGreaterThan(expectedCount - marginOfError);
        expect(baCount).toBeLessThan(expectedCount + marginOfError);

        resolve();
      });
    });
  });

  describe('Monte Carlo Statistical Testing', () => {
    it('should pass Chi-Square Goodness of Fit test for unbiased block distribution across 10,000 runs', () => {
      return new Promise<void>((resolve) => {
        let abCount = 0;
        let baCount = 0;
        let completed = 0;
        const totalRuns = 10000;

        for (let i = 0; i < totalRuns; i++) {
          const config: RandomizationConfig = {
            protocolId: 'TEST-CHI2',
            studyName: 'Chi-Square Test Study',
            phase: 'Phase 1',
            arms: [
              { id: '1', name: 'A', ratio: 1 },
              { id: '2', name: 'B', ratio: 1 }
            ],
            sites: ['Site1'],
            strata: [],
            blockSizes: [2],
            stratumCaps: [{ levels: [], cap: 2 }],
            seed: `chi_square_seed_${i}`,
            subjectIdMask: '[SiteID]-[001]'
          };

          service.generateSchema(config).subscribe(result => {
            const schema = result.schema;
            if (schema.length === 2) {
              if (schema[0].treatmentArm === 'A' && schema[1].treatmentArm === 'B') {
                abCount++;
              } else if (schema[0].treatmentArm === 'B' && schema[1].treatmentArm === 'A') {
                baCount++;
              }
            }

            completed++;
            if (completed === totalRuns) {
              const expected = totalRuns / 2;
              const chiSquare = ((abCount - expected) ** 2) / expected + ((baCount - expected) ** 2) / expected;

              // 3.841 is the critical value for 1 degree of freedom at a 0.05 significance level.
              // To pass the Goodness of Fit test (prove distribution doesn't deviate significantly),
              // the test statistic should be less than the critical value.
              expect(chiSquare).toBeLessThan(3.841);
              resolve();
            }
          });
        }
      });
    });
  });
});
