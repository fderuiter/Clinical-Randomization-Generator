import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { RandomizationService } from './randomization.service';
import { RandomizationConfig } from '../core/models/randomization.model';

describe('RandomizationService (domain)', () => {
  let service: RandomizationService;

  const baseConfig: RandomizationConfig = {
    protocolId: 'TEST-001',
    studyName: 'Test Study',
    phase: 'Phase II',
    arms: [
      { id: 'A', name: 'Active', ratio: 1 },
      { id: 'B', name: 'Placebo', ratio: 1 }
    ],
    sites: ['Site1'],
    strata: [],
    blockSizes: [4],
    stratumCaps: [{ levels: [], cap: 4 }],
    seed: 'test_seed',
    subjectIdMask: '[SiteID]-[001]'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RandomizationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate a schema with the correct number of subjects', async () => {
    const result = await firstValueFrom(service.generateSchema(baseConfig));
    expect(result).toBeTruthy();
    expect(result.schema.length).toBe(4);
  });

  it('should return an observable error when a block size is invalid', async () => {
    const invalidConfig = { ...baseConfig, blockSizes: [3] }; // 3 % 2 !== 0
    await expect(firstValueFrom(service.generateSchema(invalidConfig))).rejects.toMatchObject({
      error: { error: expect.stringContaining('not a multiple') }
    });
  });

  it('should generate a reproducible schema with the same seed', async () => {
    const result1 = await firstValueFrom(service.generateSchema(baseConfig));
    const result2 = await firstValueFrom(service.generateSchema(baseConfig));
    expect(result1.schema.map(r => r.treatmentArm))
      .toEqual(result2.schema.map(r => r.treatmentArm));
  });

  it('should generate a different schema when the seed changes', async () => {
    const config2 = { ...baseConfig, seed: 'different_seed' };
    const result1 = await firstValueFrom(service.generateSchema(baseConfig));
    const result2 = await firstValueFrom(service.generateSchema(config2));
    const same = result1.schema.map(r => r.treatmentArm).join()
      === result2.schema.map(r => r.treatmentArm).join();
    expect(same).toBe(false);
  });

  it('should auto-generate a seed when none is provided', async () => {
    const noSeedConfig = { ...baseConfig, seed: '' };
    const result = await firstValueFrom(service.generateSchema(noSeedConfig));
    expect(result.metadata.seed).toBeTruthy();
    expect(result.metadata.seed.length).toBeGreaterThan(0);
  });

  it('should apply strata correctly', async () => {
    const strataConfig: RandomizationConfig = {
      ...baseConfig,
      strata: [{ id: 'age', name: 'Age', levels: ['<65', '>=65'] }],
      stratumCaps: [
        { levels: ['<65'], cap: 4 },
        { levels: ['>=65'], cap: 4 }
      ]
    };
    const result = await firstValueFrom(service.generateSchema(strataConfig));
    expect(result.schema.length).toBe(8);
  });
});
