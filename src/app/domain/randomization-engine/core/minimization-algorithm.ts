import Decimal from 'decimal.js';
import seedrandom from 'seedrandom';
import { RandomizationConfig, GeneratedSchema, TreatmentArm } from '../../core/models/randomization.model';
import { generateSubjectId } from './subject-id-engine';

/**
 * Samples a level for one stratification factor based on expected probabilities,
 * filtering out levels that have reached their caps or are no longer valid.
 */
function sampleLevel(
  levels: string[],
  expectedProbabilities: (number | undefined)[],
  rng: seedrandom.PRNG
): string {
  if (levels.length === 0) {
    throw new Error('Cannot sample a level from an empty levels array.');
  }

  let explicitSum = new Decimal(0);
  let undefinedCount = 0;

  for (const p of expectedProbabilities) {
    if (p !== undefined && p > 0) {
      explicitSum = explicitSum.plus(new Decimal(p));
    } else if (p === undefined) {
      undefinedCount++;
    }
  }

  const probs = new Array<Decimal>(expectedProbabilities.length);

  if (explicitSum.greaterThan(1.0)) {
    for (let i = 0; i < expectedProbabilities.length; i++) {
      const p = expectedProbabilities[i];
      probs[i] = p !== undefined && p > 0 ? new Decimal(p).dividedBy(explicitSum) : new Decimal(0);
    }
  } else if (explicitSum.equals(1.0)) {
    for (let i = 0; i < expectedProbabilities.length; i++) {
      const p = expectedProbabilities[i];
      probs[i] = p !== undefined && p > 0 ? new Decimal(p) : new Decimal(0);
    }
  } else if (explicitSum.greaterThan(0) && explicitSum.lessThan(1.0)) {
    if (undefinedCount > 0) {
      const remainder = new Decimal(1.0).minus(explicitSum);
      const share = remainder.dividedBy(undefinedCount);
      for (let i = 0; i < expectedProbabilities.length; i++) {
        const p = expectedProbabilities[i];
        probs[i] = p !== undefined && p > 0 ? new Decimal(p) : (p === undefined ? share : new Decimal(0));
      }
    } else {
      for (let i = 0; i < expectedProbabilities.length; i++) {
        const p = expectedProbabilities[i];
        probs[i] = p !== undefined && p > 0 ? new Decimal(p).dividedBy(explicitSum) : new Decimal(0);
      }
    }
  } else {
    const share = new Decimal(1).dividedBy(levels.length);
    for (let i = 0; i < levels.length; i++) {
      probs[i] = share;
    }
  }

  const r = new Decimal(rng());
  let cumulative = new Decimal(0);
  for (let i = 0; i < levels.length; i++) {
    cumulative = cumulative.plus(probs[i]);
    if (r.lessThan(cumulative)) return levels[i];
  }
  return levels[levels.length - 1];
}

/**
 * Computes the Pocock-Simon imbalance score for assigning arm `candidateArmId`
 * to a subject with covariate profile `subjectProfile`.
 */
function computeImbalanceScore(
  candidateArmId: string,
  arms: TreatmentArm[],
  subjectProfile: Record<string, string>,
  marginals: Map<string, Map<string, Map<string, number>>>,
  strata: { id: string }[]
): Decimal {
  let totalScore = new Decimal(0);
  // Performance optimization: Avoid Object.entries(subjectProfile) to prevent
  // intermediate array allocations in this hot loop. Iterating over the strata
  // array directly provides a ~50% speedup for the imbalance calculation.
  for (const factor of strata) {
    const factorId = factor.id;
    const levelValue = subjectProfile[factorId];
    if (!levelValue) continue;

    const factorMarginals = marginals.get(factorId);
    if (!factorMarginals) continue;
    const levelMarginals = factorMarginals.get(levelValue);
    if (!levelMarginals) continue;

    let min: Decimal | null = null;
    let max: Decimal | null = null;
    for (const arm of arms) {
      const count = (levelMarginals.get(arm.id) ?? 0) + (arm.id === candidateArmId ? 1 : 0);
      const normalizedCount = new Decimal(count).dividedBy(new Decimal(arm.ratio));
      if (min === null || normalizedCount.lessThan(min)) min = normalizedCount;
      if (max === null || normalizedCount.greaterThan(max)) max = normalizedCount;
    }
    if (min !== null && max !== null) {
      totalScore = totalScore.plus(max.minus(min));
    }
  }
  return totalScore;
}

function computeStratumCode(strata: RandomizationConfig['strata'], stratum: Record<string, string>): string {
  return strata.map(s => (stratum[s.id] || '').substring(0, 3).toUpperCase()).join('-');
}

export function generateMinimization(
  config: RandomizationConfig,
  rng: seedrandom.PRNG
): GeneratedSchema[] {
  const { arms, strata, sites, minimizationConfig } = config;
  const p = minimizationConfig?.p ?? 0.8;
  const totalSampleSize = minimizationConfig?.totalSampleSize ?? 100;

  if (!Number.isFinite(p) || p < 0.5 || p > 1.0) {
    throw new Error(`Minimization probability p must be between 0.5 and 1.0, got: ${p}`);
  }
  if (!Number.isFinite(totalSampleSize) || totalSampleSize <= 0 || !Number.isInteger(totalSampleSize)) {
    throw new Error(`Total sample size must be a positive integer, got: ${totalSampleSize}`);
  }

  if (arms.length === 0 || sites.length === 0) return [];

  const schema: GeneratedSchema[] = [];
  const usedSubjectIds = new Set<string>();

  // Precompute expected probabilities from config.
  const baseProbabilities = new Map<string, Map<string, number | undefined>>();
  for (const factor of strata) {
    const pMap = new Map<string, number | undefined>();
    const detailsMap = new Map<string, NonNullable<typeof factor.levelDetails>[number]>();
    if (factor.levelDetails) {
      for (const d of factor.levelDetails) {
        detailsMap.set(d.name, d);
      }
    }
    for (const level of factor.levels) {
      const details = detailsMap.get(level);
      pMap.set(level, details?.expectedProbability);
    }
    baseProbabilities.set(factor.id, pMap);
  }

  // Setup caps and state tracking
  const isMarginal = config.capStrategy === 'MARGINAL_ONLY';

  // MARGINAL tracking
  const marginalCapMap = new Map<string, Map<string, number | undefined>>();
  const marginalCounts = new Map<string, Map<string, number>>();

  // INTERSECTION tracking (MANUAL_MATRIX or PROPORTIONAL)
  const capsDict: Record<string, number> = {};
  const intersectionCounts: Record<string, number> = {};

  if (isMarginal) {
    for (const factor of strata) {
      const capMap = new Map<string, number | undefined>();
      const countMap = new Map<string, number>();
      const detailsMap = new Map<string, NonNullable<typeof factor.levelDetails>[number]>();
      if (factor.levelDetails) {
        for (const d of factor.levelDetails) {
          detailsMap.set(d.name, d);
        }
      }
      for (const level of factor.levels) {
        const details = detailsMap.get(level);
        capMap.set(level, details?.marginalCap);
        countMap.set(level, 0);
      }
      marginalCapMap.set(factor.id, capMap);
      marginalCounts.set(factor.id, countMap);
    }
  } else {
    (config.stratumCaps || []).forEach(c => {
      if (c.levelIds) {
        const key = Object.keys(c.levelIds).sort().map(k => `${k}:${c.levelIds[k]}`).join('|');
        capsDict[key] = c.cap;
      }
    });
  }

  // Precompute all strata combinations to form the initial valid pool for intersection caps.
  type PoolCombination = Record<string, string> & { _key?: string };
  let activePool: PoolCombination[] = [{}];
  if (!isMarginal) {
    for (const factor of strata) {
      const newCombinations: PoolCombination[] = [];
      for (const combo of activePool) {
        for (const level of factor.levels) {
          newCombinations.push({ ...combo, [factor.id]: level });
        }
      }
      activePool = newCombinations;
    }

    // Filter activePool immediately for any combinations that have a cap of 0
    // Precalculate invariant key for filtering and sampling arrays and filter immediately
    const validPool: PoolCombination[] = [];
    for (const combo of activePool) {
      const key = Object.keys(combo).filter(k => k !== '_key').sort().map(k => `${k}:${combo[k]}`).join('|');
      combo._key = key;
      const cap = capsDict[key];
      if (cap === undefined || cap > 0) {
        validPool.push(combo);
      }
    }
    activePool = validPool;
  }

  const siteSubjectCounts = new Map<string, number>();
  for (const site of sites) {
    siteSubjectCounts.set(site, 0);
  }

  // marginals[site][factorId][levelValue][armId] = count (for imbalance score calculation per site)
  // Or is minimization global or per-site? Usually minimization balances per site by adding Site as a factor or tracking marginals per site.
  // The original code reset marginals PER SITE loop, which implies imbalance is tracked purely PER SITE.
  // We'll maintain a Map of marginals per site.
  const siteMarginals = new Map<string, Map<string, Map<string, Map<string, number>>>>();
  for (const site of sites) {
    const marginals = new Map<string, Map<string, Map<string, number>>>();
    for (const factor of strata) {
      const factorMap = new Map<string, Map<string, number>>();
      for (const level of factor.levels) {
        const armMap = new Map<string, number>();
        for (const arm of arms) {
          armMap.set(arm.id, 0);
        }
        factorMap.set(level, armMap);
      }
      marginals.set(factor.id, factorMap);
    }
    siteMarginals.set(site, marginals);
  }

  let poolNeedsFilter = true;

  // Generate subjects one by one up to totalSampleSize
  for (let s = 0; s < totalSampleSize; s++) {
    // Determine active pool dynamically. If MARGINAL_ONLY, filter based on marginal counts.
    if (isMarginal) {
      const isExhausted = strata.some(factor => {
        return factor.levels.every(level => {
          const cap = marginalCapMap.get(factor.id)?.get(level);
          const count = marginalCounts.get(factor.id)?.get(level) ?? 0;
          return cap !== undefined && count >= cap;
        });
      });
      if (isExhausted) {
        break;
      }
    } else {
      if (poolNeedsFilter) {
        const newPool: PoolCombination[] = [];
        for (const combo of activePool) {

          const key = combo._key || "";
          const cap = capsDict[key];
          if (cap === undefined || (intersectionCounts[key] ?? 0) < cap) {
            newPool.push(combo);
          }
        }
        activePool = newPool;
        poolNeedsFilter = false;
      }

      if (activePool.length === 0) {
        // No more valid combinations exist; exhaustion reached.
        break;
      }
    }

    // Determine available sites (all sites are uniformly available for now, since no site caps exist)
    // Select site uniformly
    const siteIdx = Math.floor(rng() * sites.length);
    const site = sites[siteIdx];

    const subjectProfile: Record<string, string> = {};
    const stratum: Record<string, string> = {};

    const currentCombinationPrefix: Record<string, string> = {};

    let validSubject = true;

    // Sample each factor sequentially, dynamically adjusting probabilities based on active pool
    for (const factor of strata) {
      let availableLevels: string[];

      if (isMarginal) {
        availableLevels = factor.levels.filter(level => {
          const cap = marginalCapMap.get(factor.id)?.get(level);
          const count = marginalCounts.get(factor.id)?.get(level) ?? 0;
          return cap === undefined || count < cap;
        });
      } else {
        // Find levels that are still present in at least one combination in the activePool
        // that matches the already sampled prefix.
        // Find levels that are still present in at least one combination in the activePool
        // that matches the already sampled prefix.
        const prefixKeys = Object.keys(currentCombinationPrefix);
        const activeLevels = new Set<string>();
        for (const combo of activePool) {

          // Optimization: Check the specific target factor level first before doing the full prefix check.
          // This allows us to skip the entire inner loop if we already know this level is valid.
          const levelVal = combo[factor.id];
          if (activeLevels.has(levelVal)) continue;

          let match = true;
          for (const k of prefixKeys) {

            if (combo[k] !== currentCombinationPrefix[k]) {
              match = false;
              break;
            }
          }
          if (match) {
            activeLevels.add(levelVal);
            if (activeLevels.size === factor.levels.length) break;
          }
        }
        availableLevels = factor.levels.filter(level => activeLevels.has(level));
      }

      if (availableLevels.length === 0) {
        validSubject = false;
        break; // Should not happen given exhaustion check > 0
      }

      const expectedProbs = availableLevels.map(lvl => baseProbabilities.get(factor.id)?.get(lvl));

      const level = sampleLevel(availableLevels, expectedProbs, rng);
      subjectProfile[factor.id] = level;
      stratum[factor.id] = level;
      currentCombinationPrefix[factor.id] = level;
    }

    if (!validSubject) break;

    // We have a valid subject profile. Now calculate Imbalance Score per site.
    const marginals = siteMarginals.get(site)!;

    let minScore: Decimal | null = null;
    const armScores: Decimal[] = [];
    for (const arm of arms) {
      const score = computeImbalanceScore(arm.id, arms, subjectProfile, marginals, strata);
      armScores.push(score);
      if (minScore === null || score.lessThan(minScore)) minScore = score;
    }

    const preferred: TreatmentArm[] = [];
    const nonPreferred: TreatmentArm[] = [];
    for (let j = 0; j < arms.length; j++) {
      const arm = arms[j];
      if (armScores[j].equals(minScore!)) {
        preferred.push(arm);
      } else {
        nonPreferred.push(arm);
      }
    }

    let assignedArm: TreatmentArm;

    const selectWeightedArm = (candidates: TreatmentArm[]): TreatmentArm => {
      const totalWeight = candidates.reduce((sum, arm) => sum.plus(new Decimal(arm.ratio)), new Decimal(0));
      if (totalWeight.isZero()) {
        throw new Error('Total weight of tied arms is 0. Cannot select an arm.');
      }

      let rVal = new Decimal(rng()).times(totalWeight);
      for (const arm of candidates) {
        rVal = rVal.minus(new Decimal(arm.ratio));
        if (rVal.lessThanOrEqualTo(0)) {
          return arm;
        }
      }
      return candidates[candidates.length - 1];
    };

    if (preferred.length === arms.length || nonPreferred.length === 0) {
      assignedArm = selectWeightedArm(preferred);
    } else {
      const r = new Decimal(rng());
      if (r.lessThan(p)) {
        assignedArm = selectWeightedArm(preferred);
      } else {
        assignedArm = selectWeightedArm(nonPreferred);
      }
    }

    // Update marginals for imbalance tracking
    for (const factor of strata) {
      const levelValue = subjectProfile[factor.id];
      if (levelValue) {
        marginals.get(factor.id)?.get(levelValue)?.set(
          assignedArm.id,
          (marginals.get(factor.id)?.get(levelValue)?.get(assignedArm.id) ?? 0) + 1
        );
      }
    }

    // Update state tracking
    if (isMarginal) {
      for (const factor of strata) {
        const lvl = subjectProfile[factor.id];
        if (lvl) {
          const map = marginalCounts.get(factor.id)!;
          map.set(lvl, (map.get(lvl) ?? 0) + 1);
        }
      }
    } else {
      const key = Object.keys(subjectProfile).sort().map(k => `${k}:${subjectProfile[k]}`).join('|');
      const newCount = (intersectionCounts[key] ?? 0) + 1;
      intersectionCounts[key] = newCount;
      const cap = capsDict[key];
      if (cap !== undefined && newCount >= cap) {
        poolNeedsFilter = true;
      }
    }

    siteSubjectCounts.set(site, siteSubjectCounts.get(site)! + 1);
    const siteSeq = siteSubjectCounts.get(site)!;

    const stratumCode = computeStratumCode(strata, stratum);

    const subjectId = generateSubjectId(
      config.subjectIdMask,
      { site, stratumCode, sequence: siteSeq },
      usedSubjectIds
    );

    schema.push({
      subjectId,
      site,
      stratum,
      stratumCode,
      blockNumber: 0,
      blockSize: 0,
      treatmentArm: assignedArm.name,
      treatmentArmId: assignedArm.id
    });
  }

  return schema;
}
