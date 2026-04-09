import seedrandom from 'seedrandom';
import {
  TreatmentArm,
  RandomizationConfig,
  GeneratedSchema,
  RandomizationResult
} from '../../core/models/randomization.model';
import { generateSubjectId } from './subject-id-engine';

// ---------------------------------------------------------------------------
// Shared block-generation helpers
// ---------------------------------------------------------------------------

function buildBlock(arms: TreatmentArm[], blockSize: number, totalRatio: number, rng: seedrandom.PRNG): TreatmentArm[] {
  const block: TreatmentArm[] = [];
  const multiplier = blockSize / totalRatio;
  for (const arm of arms) {
    for (let i = 0; i < arm.ratio * multiplier; i++) {
      block.push(arm);
    }
  }
  // Fisher-Yates shuffle
  for (let i = block.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [block[i], block[j]] = [block[j], block[i]];
  }
  return block;
}

function computeStratumCode(strata: RandomizationConfig['strata'], stratum: Record<string, string>): string {
  return strata.map(s => (stratum[s.id] || '').substring(0, 3).toUpperCase()).join('-');
}

// ---------------------------------------------------------------------------
// Standard (MANUAL_MATRIX / PROPORTIONAL) generation path
// ---------------------------------------------------------------------------

function generateStandard(
  resolvedConfig: RandomizationConfig,
  rng: seedrandom.PRNG,
  strataCombinations: Record<string, string>[],
  totalRatio: number,
  schema: GeneratedSchema[],
  usedSubjectIds: Set<string>
): void {
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
        const block = buildBlock(resolvedConfig.arms, blockSize, totalRatio, rng);
        const stratumCode = computeStratumCode(resolvedConfig.strata, stratum);

        for (const arm of block) {
          siteSubjectCount++;
          stratumSubjectCount++;

          const subjectId = generateSubjectId(
            resolvedConfig.subjectIdMask,
            { site, stratumCode, sequence: siteSubjectCount },
            usedSubjectIds
          );

          schema.push({ subjectId, site, stratum, stratumCode, blockNumber, blockSize, treatmentArm: arm.name, treatmentArmId: arm.id });

          if (stratumSubjectCount >= maxSubjectsPerStratum) break;
        }
        blockNumber++;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// MARGINAL_ONLY generation path
// ---------------------------------------------------------------------------

/**
 * Generates subjects using marginal-cap enforcement.
 *
 * Instead of pre-defined intersection caps, each factor level carries a `marginalCap`
 * (from `factor.levelDetails[].marginalCap`). The engine maintains a running count
 * per level and rejects any combination whose levels would breach their caps.
 * Combinations are drawn at random until no valid combination remains.
 *
 * @throws {Error} When no finite marginal cap is defined (the pool would never shrink).
 */
function generateMarginalOnly(
  resolvedConfig: RandomizationConfig,
  rng: seedrandom.PRNG,
  strataCombinations: Record<string, string>[],
  totalRatio: number,
  schema: GeneratedSchema[],
  usedSubjectIds: Set<string>
): void {
  // Use Map to avoid prototype-pollution risks when level names are user-controlled.
  // Lookup: factorId → (levelName → marginalCap); undefined = uncapped.
  const marginalCapMap = new Map<string, Map<string, number | undefined>>();
  let hasFiniteCap = false;
  for (const factor of resolvedConfig.strata) {
    const levelMap = new Map<string, number | undefined>();
    if (factor.levelDetails) {
      for (const detail of factor.levelDetails) {
        levelMap.set(detail.name, detail.marginalCap);
        if (detail.marginalCap !== undefined) hasFiniteCap = true;
      }
    }
    marginalCapMap.set(factor.id, levelMap);
  }

  // Guard: if every level is uncapped the active pool never shrinks and the while-loop
  // would run indefinitely. Require at least one finite marginal cap.
  if (!hasFiniteCap) {
    throw new Error(
      'MARGINAL_ONLY randomization requires at least one finite marginal cap to guarantee termination. ' +
      'Set a marginalCap on at least one stratum level.'
    );
  }

  for (const site of resolvedConfig.sites) {
    let siteSubjectCount = 0;
    let blockNumber = 0;

    // Marginal enrollment counts are tracked per-site (each site is independent).
    const marginalCounts = new Map<string, Map<string, number>>();
    for (const factor of resolvedConfig.strata) {
      const countMap = new Map<string, number>();
      for (const level of factor.levels) {
        countMap.set(level, 0);
      }
      marginalCounts.set(factor.id, countMap);
    }

    // Active pool of valid stratum combinations (those that haven't hit any marginal cap).
    let activePool = [...strataCombinations];

    while (activePool.length > 0) {
      // Randomly select a combination from the active pool.
      const poolIdx = Math.floor(rng() * activePool.length);
      const stratum = activePool[poolIdx];

      // Pick a block size.
      const blockSizeIndex = Math.floor(rng() * resolvedConfig.blockSizes.length);
      const blockSize = resolvedConfig.blockSizes[blockSizeIndex];
      const block = buildBlock(resolvedConfig.arms, blockSize, totalRatio, rng);
      const stratumCode = computeStratumCode(resolvedConfig.strata, stratum);
      blockNumber++;

      for (const arm of block) {
        // Check if adding this subject would breach any marginal cap.
        let canAdd = true;
        for (const factor of resolvedConfig.strata) {
          const levelValue = stratum[factor.id] || '';
          if (!levelValue) continue;
          const cap = marginalCapMap.get(factor.id)?.get(levelValue);
          const currentCount = marginalCounts.get(factor.id)?.get(levelValue) ?? 0;
          if (cap !== undefined && currentCount >= cap) {
            canAdd = false;
            break;
          }
        }
        if (!canAdd) break; // Stop the block early when a cap is reached.

        siteSubjectCount++;

        const subjectId = generateSubjectId(
          resolvedConfig.subjectIdMask,
          { site, stratumCode, sequence: siteSubjectCount },
          usedSubjectIds
        );

        schema.push({
          subjectId, site, stratum, stratumCode,
          blockNumber,
          blockSize,
          treatmentArm: arm.name,
          treatmentArmId: arm.id
        });

        // Update marginal counts for every factor level in this stratum.
        for (const factor of resolvedConfig.strata) {
          const levelValue = stratum[factor.id] || '';
          if (levelValue) {
            const countMap = marginalCounts.get(factor.id);
            if (countMap) {
              countMap.set(levelValue, (countMap.get(levelValue) ?? 0) + 1);
            }
          }
        }
      }

      // Remove combinations from the pool that would now breach a marginal cap.
      activePool = activePool.filter(combo =>
        resolvedConfig.strata.every(factor => {
          const levelValue = combo[factor.id] || '';
          if (!levelValue) return true;
          const cap = marginalCapMap.get(factor.id)?.get(levelValue);
          if (cap === undefined) return true; // uncapped
          return (marginalCounts.get(factor.id)?.get(levelValue) ?? 0) < cap;
        })
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

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
  /** Tracks all assigned subject IDs to prevent duplicates (relevant for {RND:n} tokens). */
  const usedSubjectIds = new Set<string>();

  if (resolvedConfig.capStrategy === 'MARGINAL_ONLY') {
    generateMarginalOnly(resolvedConfig, rng, strataCombinations, totalRatio, schema, usedSubjectIds);
  } else {
    // Both 'MANUAL_MATRIX' (default) and 'PROPORTIONAL' use intersection caps.
    generateStandard(resolvedConfig, rng, strataCombinations, totalRatio, schema, usedSubjectIds);
  }

  return {
    metadata: {
      protocolId: resolvedConfig.protocolId,
      studyName: resolvedConfig.studyName,
      phase: resolvedConfig.phase,
      seed: resolvedConfig.seed,
      generatedAt: new Date().toISOString(),
      strata: resolvedConfig.strata,
      config: resolvedConfig,
      auditHash: '' // populated asynchronously by the facade after generation
    },
    schema
  };
}
