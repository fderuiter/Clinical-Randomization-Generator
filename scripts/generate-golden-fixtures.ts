import fs from 'fs';
import path from 'path';
import { generateRandomizationSchema } from '../src/app/domain/randomization-engine/core/randomization-algorithm';
import { RandomizationConfig } from '../src/app/core/models/randomization.model';

const CONFIGS: Record<string, RandomizationConfig> = {
  standard_block: {
    protocolId: 'GOLDEN-001',
    studyName: 'Standard Block',
    phase: 'Phase I',
    arms: [
      { id: 'A', name: 'Drug', ratio: 1 },
      { id: 'B', name: 'Placebo', ratio: 1 }
    ],
    sites: ['S01', 'S02'],
    strata: [],
    blockSizes: [4],
    stratumCaps: [{ levels: [], cap: 8 }],
    seed: 'GOLDEN_SEED_1',
    subjectIdMask: '{SITE}-{SEQ:3}',
    randomizationMethod: 'PERMUTED_BLOCK'
  },
  minimization: {
    protocolId: 'GOLDEN-002',
    studyName: 'Minimization',
    phase: 'Phase II',
    arms: [
      { id: 'T', name: 'Treatment', ratio: 1 },
      { id: 'P', name: 'Placebo', ratio: 1 }
    ],
    sites: ['SITE-A'],
    strata: [{ id: 'age', name: 'Age', levels: ['<65', '>=65'] }],
    blockSizes: [4],
    stratumCaps: [],
    seed: 'GOLDEN_SEED_2',
    subjectIdMask: '{SITE}-{SEQ:3}',
    randomizationMethod: 'MINIMIZATION',
    minimizationConfig: { p: 0.8, totalSampleSize: 10 }
  },
  capped: {
    protocolId: 'GOLDEN-003',
    studyName: 'Capped',
    phase: 'Phase III',
    arms: [
      { id: 'D', name: 'Drug', ratio: 2 },
      { id: 'C', name: 'Control', ratio: 1 }
    ],
    sites: ['US01'],
    strata: [
      { id: 'sex', name: 'Sex', levels: ['M', 'F'], levelDetails: [{name: 'M', marginalCap: 4}, {name: 'F', marginalCap: 6}] }
    ],
    blockSizes: [3],
    stratumCaps: [],
    capStrategy: 'MARGINAL_ONLY',
    seed: 'GOLDEN_SEED_3',
    subjectIdMask: '{SITE}-{SEQ:3}',
    randomizationMethod: 'PERMUTED_BLOCK'
  },
  zero_padding: {
    protocolId: 'GOLDEN-004',
    studyName: 'Zero Padding',
    phase: 'Phase III',
    arms: [
      { id: 'A', name: 'Low Dose', ratio: 1 },
      { id: 'B', name: 'Placebo', ratio: 1 }
    ],
    sites: ['US01'],
    strata: [],
    blockSizes: [2],
    stratumCaps: [{ levels: [], cap: 4 }],
    seed: 'GOLDEN_SEED_4',
    subjectIdMask: '{SITE}-{SEQ:5}',
    randomizationMethod: 'PERMUTED_BLOCK'
  },
  complex_multi_strata: {
    protocolId: 'GOLDEN-005',
    studyName: 'Complex',
    phase: 'Phase IV',
    arms: [
      { id: 'A', name: 'Active', ratio: 1 },
      { id: 'B', name: 'Placebo', ratio: 1 }
    ],
    sites: ['S1', 'S2'],
    strata: [
      { id: 'risk', name: 'Risk', levels: ['Low', 'High'] },
      { id: 'region', name: 'Region', levels: ['NA', 'EU'] }
    ],
    blockSizes: [2, 4],
    stratumCaps: [
      { levels: ['Low', 'NA'], cap: 4 },
      { levels: ['Low', 'EU'], cap: 4 },
      { levels: ['High', 'NA'], cap: 4 },
      { levels: ['High', 'EU'], cap: 4 }
    ],
    seed: 'GOLDEN_SEED_5',
    subjectIdMask: '{SITE}-{SEQ:3}',
    randomizationMethod: 'PERMUTED_BLOCK'
  }
};

const output = {};
for (const [key, config] of Object.entries(CONFIGS)) {
  const result = generateRandomizationSchema(config);
  // strip timestamp and metadata
  output[key] = {
    config,
    schema: result.schema.map(r => ({
      subjectId: r.subjectId,
      site: r.site,
      stratum: r.stratum,
      stratumCode: r.stratumCode,
      blockNumber: r.blockNumber,
      blockSize: r.blockSize,
      treatmentArm: r.treatmentArm,
      treatmentArmId: r.treatmentArmId
    }))
  };
}

fs.writeFileSync(
  path.join(__dirname, '../src/app/domain/randomization-engine/core/randomization-algorithm-golden.json'),
  JSON.stringify(output, null, 2)
);
