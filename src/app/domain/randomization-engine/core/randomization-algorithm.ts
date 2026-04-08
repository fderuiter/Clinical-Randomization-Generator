import seedrandom from 'seedrandom';
import {
  TreatmentArm,
  RandomizationConfig,
  GeneratedSchema,
  RandomizationResult
} from '../../core/models/randomization.model';

/**
 * Pure TypeScript randomization algorithm with no Angular dependencies.
 * This function is safe to import in Web Workers and SSR contexts.
 *
 * @throws {Error} When a block size is not a multiple of the total arm ratio.
 */
export function generateRandomizationSchema(config: RandomizationConfig): RandomizationResult {
  const resolvedConfig = config.seed
    ? config
    : { ...config, seed: Math.random().toString(36).substring(2, 15) };

  const rng = seedrandom(resolvedConfig.seed);

  // Generate all strata combinations
  let strataCombinations: Record<string, string>[] = [{}];
  for (const factor of resolvedConfig.strata) {
    const newCombinations: Record<string, string>[] = [];
    for (const combo of strataCombinations) {
      for (const level of factor.levels) {
        newCombinations.push({ ...combo, [factor.id]: level });
      }
    }
    strataCombinations = newCombinations;
  }

  // Calculate total ratio sum
  const totalRatio = resolvedConfig.arms.reduce((sum, arm) => sum + arm.ratio, 0);

  // Validate block sizes
  for (const size of resolvedConfig.blockSizes) {
    if (size % totalRatio !== 0) {
      throw new Error(`Block size ${size} is not a multiple of total ratio ${totalRatio}`);
    }
  }

  const schema: GeneratedSchema[] = [];

  // Convert caps to a dictionary for easy lookup
  const capsDict: Record<string, number> = {};
  if (resolvedConfig.stratumCaps) {
    resolvedConfig.stratumCaps.forEach(c => {
      capsDict[c.levels.join('|')] = c.cap;
    });
  }

  for (const site of resolvedConfig.sites) {
    let siteSubjectCount = 0;
    for (const stratum of strataCombinations) {
      const comboKey = resolvedConfig.strata.map(s => stratum[s.id] || '').join('|');
      const maxSubjectsPerStratum = capsDict[comboKey] || 0;

      let stratumSubjectCount = 0;
      let blockNumber = 1;

      while (stratumSubjectCount < maxSubjectsPerStratum) {
        const blockSizeIndex = Math.floor(rng() * resolvedConfig.blockSizes.length);
        const blockSize = resolvedConfig.blockSizes[blockSizeIndex];

        const block: TreatmentArm[] = [];
        const multiplier = blockSize / totalRatio;

        for (const arm of resolvedConfig.arms) {
          for (let i = 0; i < arm.ratio * multiplier; i++) {
            block.push(arm);
          }
        }

        // Fisher-Yates shuffle
        for (let i = block.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [block[i], block[j]] = [block[j], block[i]];
        }

        for (const arm of block) {
          siteSubjectCount++;
          stratumSubjectCount++;

          let subjectId = resolvedConfig.subjectIdMask;
          subjectId = subjectId.replace('[SiteID]', site);

          const stratumCode = resolvedConfig.strata
            .map(s => (stratum[s.id] || '').substring(0, 3).toUpperCase())
            .join('-');
          subjectId = subjectId.replace('[StratumCode]', stratumCode);

          const match = subjectId.match(/\[(0+)1\]/);
          if (match) {
            const padding = match[1].length + 1;
            const paddedNum = siteSubjectCount.toString().padStart(padding, '0');
            subjectId = subjectId.replace(match[0], paddedNum);
          } else {
            subjectId = subjectId.replace('[001]', siteSubjectCount.toString().padStart(3, '0'));
          }

          schema.push({
            subjectId,
            site,
            stratum,
            stratumCode,
            blockNumber,
            blockSize,
            treatmentArm: arm.name,
            treatmentArmId: arm.id
          });

          if (stratumSubjectCount >= maxSubjectsPerStratum) break;
        }
        blockNumber++;
      }
    }
  }

  return {
    metadata: {
      protocolId: resolvedConfig.protocolId,
      studyName: resolvedConfig.studyName,
      phase: resolvedConfig.phase,
      seed: resolvedConfig.seed,
      generatedAt: new Date().toISOString(),
      strata: resolvedConfig.strata,
      config: resolvedConfig
    },
    schema
  };
}
