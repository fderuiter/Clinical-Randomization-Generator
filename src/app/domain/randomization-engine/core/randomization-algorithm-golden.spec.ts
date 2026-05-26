import goldenFixtures from './randomization-algorithm-golden.json';
import { generateRandomizationSchema } from './randomization-algorithm';
import { RandomizationConfig } from '../../core/models/randomization.model';

describe('Golden Regression Fixtures', () => {
  for (const [key, fixture] of Object.entries(goldenFixtures)) {
    it(`should match golden output for ${key}`, () => {
      const result = generateRandomizationSchema(fixture.config as RandomizationConfig);

      const schema = result.schema.map(r => ({
        subjectId: r.subjectId,
        site: r.site,
        stratum: r.stratum,
        stratumCode: r.stratumCode,
        blockNumber: r.blockNumber,
        blockSize: r.blockSize,
        treatmentArm: r.treatmentArm,
        treatmentArmId: r.treatmentArmId
      }));

      expect(schema).toEqual(fixture.schema);
    });
  }
});
