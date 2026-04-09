import seedrandom from 'seedrandom';
import {
  TreatmentArm,
  RandomizationConfig,
  GeneratedSchema,
  RandomizationResult
} from '../../core/models/randomization.model';
import { generateSubjectId } from './subject-id-engine';

/**
 * Pure TypeScript randomization algorithm with no Angular dependencies.
 * This function is safe to import in Web Workers and SSR contexts.
 *
 * @throws {Error} When a block size is not a multiple of the total arm ratio (permuted block only).
 */
export function generateRandomizationSchema(config: RandomizationConfig): RandomizationResult {
  const resolvedConfig = config.seed
    ? config
    : { ...config, seed: Math.random().toString(36).substring(2, 15) };

  const method = resolvedConfig.randomizationMethod ?? 'PERMUTED_BLOCK';
  if (method === 'MINIMIZATION') {
    return generateMinimizationSchema(resolvedConfig);
  }

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

          const stratumCode = resolvedConfig.strata
            .map(s => (stratum[s.id] || '').substring(0, 3).toUpperCase())
            .join('-');

          const subjectId = generateSubjectId(
            resolvedConfig.subjectIdMask,
            { site, stratumCode, sequence: siteSubjectCount },
            usedSubjectIds
          );

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

// ---------------------------------------------------------------------------
// Pocock-Simon Minimization Algorithm
// ---------------------------------------------------------------------------

/**
 * Implements the Pocock-Simon minimization (covariate-adaptive) randomization.
 *
 * For each simulated subject the algorithm:
 * 1. Randomly assigns a covariate profile by sampling from each stratum factor.
 * 2. For each treatment arm, calculates the marginal imbalance if that arm
 *    were assigned (Range method: max − min across all marginal totals touched
 *    by the subject's covariates).
 * 3. Identifies the arm(s) yielding the lowest imbalance score.
 * 4. Applies the biased-coin rule: with probability p assigns the minimising
 *    arm; with probability (1-p) assigns one of the others at random.
 *    On a tie, simple randomisation is used among tied arms.
 * 5. Updates the persistent marginal-total counters.
 *
 * @internal Called only by `generateRandomizationSchema` when method === 'MINIMIZATION'.
 */
function generateMinimizationSchema(config: RandomizationConfig): RandomizationResult {
  const rng = seedrandom(config.seed);
  const targetEnrollment = config.targetEnrollment ?? 0;
  const biasedCoinProbability = config.biasedCoinProbability ?? 0.8;

  if (targetEnrollment <= 0) {
    return {
      metadata: {
        protocolId: config.protocolId,
        studyName: config.studyName,
        phase: config.phase,
        seed: config.seed,
        generatedAt: new Date().toISOString(),
        strata: config.strata,
        config
      },
      schema: []
    };
  }

  const arms = config.arms;
  const strata = config.strata;
  const sites = config.sites.length > 0 ? config.sites : ['DEFAULT'];

  // Marginal totals: Map<factor_id, Map<level, Map<arm_id, count>>>
  const marginalTotals = new Map<string, Map<string, Map<string, number>>>();
  for (const factor of strata) {
    const factorMap = new Map<string, Map<string, number>>();
    for (const level of factor.levels) {
      const armMap = new Map<string, number>();
      for (const arm of arms) armMap.set(arm.id, 0);
      factorMap.set(level, armMap);
    }
    marginalTotals.set(factor.id, factorMap);
  }

  const schema: GeneratedSchema[] = [];
  const usedSubjectIds = new Set<string>();
  /** Site-level subject counter for Subject ID generation. */
  const siteCounters = new Map<string, number>();

  for (let subjectIndex = 0; subjectIndex < targetEnrollment; subjectIndex++) {
    // 1. Randomly assign a site (uniform over configured sites)
    const siteIdx = Math.floor(rng() * sites.length);
    const site = sites[siteIdx];

    // 2. Randomly assign a covariate profile (one level per factor, uniform)
    const stratum: Record<string, string> = {};
    for (const factor of strata) {
      if (factor.levels.length > 0) {
        const levelIdx = Math.floor(rng() * factor.levels.length);
        stratum[factor.id] = factor.levels[levelIdx];
      }
    }

    // 3. Calculate imbalance for each arm if this subject is assigned to it
    const imbalanceScores = new Map<string, number>();
    for (const candidateArm of arms) {
      let totalRange = 0;
      for (const factor of strata) {
        const level = stratum[factor.id];
        if (!level) continue;
        const factorMap = marginalTotals.get(factor.id);
        if (!factorMap) continue;
        const levelMap = factorMap.get(level);
        if (!levelMap) continue;

        // Hypothetically assign to candidateArm and compute range across arms
        let maxCount = -Infinity;
        let minCount = Infinity;
        for (const arm of arms) {
          const count = (levelMap.get(arm.id) ?? 0) + (arm.id === candidateArm.id ? 1 : 0);
          if (count > maxCount) maxCount = count;
          if (count < minCount) minCount = count;
        }
        totalRange += maxCount - minCount;
      }
      imbalanceScores.set(candidateArm.id, totalRange);
    }

    // 4. Find minimum imbalance score
    let minScore = Infinity;
    for (const score of imbalanceScores.values()) {
      if (score < minScore) minScore = score;
    }

    const winningArms = arms.filter(a => imbalanceScores.get(a.id) === minScore);
    const losingArms = arms.filter(a => imbalanceScores.get(a.id) !== minScore);

    // 5. Biased-coin assignment
    let chosenArm: TreatmentArm;
    if (winningArms.length === arms.length || losingArms.length === 0) {
      // Perfect tie across all arms (or first subject) – simple randomisation
      const idx = Math.floor(rng() * arms.length);
      chosenArm = arms[idx];
    } else if (winningArms.length > 1) {
      // Multiple winners – simple randomisation among them (ignore biased coin)
      const idx = Math.floor(rng() * winningArms.length);
      chosenArm = winningArms[idx];
    } else {
      // Single winner – apply biased coin
      const coin = rng();
      if (coin < biasedCoinProbability) {
        chosenArm = winningArms[0];
      } else {
        const idx = Math.floor(rng() * losingArms.length);
        chosenArm = losingArms[idx];
      }
    }

    // 6. Update marginal totals
    for (const factor of strata) {
      const level = stratum[factor.id];
      if (!level) continue;
      const factorMap = marginalTotals.get(factor.id);
      if (!factorMap) continue;
      const levelMap = factorMap.get(level);
      if (!levelMap) continue;
      levelMap.set(chosenArm.id, (levelMap.get(chosenArm.id) ?? 0) + 1);
    }

    // 7. Build schema row
    const siteCount = (siteCounters.get(site) ?? 0) + 1;
    siteCounters.set(site, siteCount);

    const stratumCode = strata
      .map(s => (stratum[s.id] || '').substring(0, 3).toUpperCase())
      .join('-');

    const subjectId = generateSubjectId(
      config.subjectIdMask,
      { site, stratumCode, sequence: siteCount },
      usedSubjectIds
    );

    schema.push({
      subjectId,
      site,
      stratum,
      stratumCode,
      // Minimization does not use blocks; use N/A sentinel values
      blockNumber: 0,
      blockSize: 0,
      treatmentArm: chosenArm.name,
      treatmentArmId: chosenArm.id
    });
  }

  return {
    metadata: {
      protocolId: config.protocolId,
      studyName: config.studyName,
      phase: config.phase,
      seed: config.seed,
      generatedAt: new Date().toISOString(),
      strata: config.strata,
      config
    },
    schema
  };
}
