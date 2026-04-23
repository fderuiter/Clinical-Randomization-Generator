import * as fs from 'fs';

const testFile = 'src/app/domain/randomization-engine/core/minimization-algorithm.spec.ts';
let content = fs.readFileSync(testFile, 'utf8');

const testsToAdd = `
  describe('Regression Prevention Tests', () => {
    it('Issue 5: Returns a truncated schema when total caps sum to less than totalSampleSize', () => {
      // Configuration where totalSampleSize is 100, but caps sum to 40
      const restrictedConfig: RandomizationConfig = {
        ...baseConfig,
        minimizationConfig: { p: 0.8, totalSampleSize: 100 },
        capStrategy: 'MANUAL_MATRIX',
        stratumCaps: [
          { levels: ['Male'], cap: 20 },
          { levels: ['Female'], cap: 20 }
        ]
      };

      const rng = seedrandom('truncationTest');
      const schema = generateMinimization(restrictedConfig, rng);
      expect(schema.length).toBe(40);
    });

    it('Issue 5: Respects MARGINAL_ONLY caps exactly and dynamically recalculates probabilities', () => {
      // MARGINAL_ONLY configuration where one factor level has a cap of 5
      const marginalConfig: RandomizationConfig = {
        ...baseConfig,
        minimizationConfig: { p: 0.8, totalSampleSize: 50 },
        capStrategy: 'MARGINAL_ONLY',
        strata: [
          {
            id: 'sex',
            name: 'Sex',
            levels: ['Male', 'Female'],
            levelDetails: [
              { name: 'Male', expectedProbability: 0.5, marginalCap: 5 },
              { name: 'Female', expectedProbability: 0.5 }
            ]
          }
        ]
      };

      const rng = seedrandom('marginalTest');
      const start = performance.now();
      const schema = generateMinimization(marginalConfig, rng);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Ensures dynamic probability recalculation prevents infinite loops

      const maleCount = schema.filter(r => r.stratum['sex'] === 'Male').length;
      const femaleCount = schema.filter(r => r.stratum['sex'] === 'Female').length;

      expect(maleCount).toBe(5);
      expect(femaleCount).toBe(45);
      expect(schema.length).toBe(50);
    });
  });
`;

if (!content.includes('Regression Prevention Tests')) {
  // Find the last index of `});` to insert before the end of the file
  const insertionPoint = content.lastIndexOf('});');
  content = content.slice(0, insertionPoint) + testsToAdd + content.slice(insertionPoint);
  fs.writeFileSync(testFile, content, 'utf8');
  console.log("Patched minimization-algorithm.spec.ts successfully.");
} else {
  console.log("Regression Prevention Tests already exist.");
}
