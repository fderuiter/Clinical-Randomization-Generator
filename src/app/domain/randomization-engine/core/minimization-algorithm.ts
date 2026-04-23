import seedrandom from 'seedrandom';
import { RandomizationConfig, GeneratedSchema, TreatmentArm } from '../../core/models/randomization.model';
import { generateSubjectId } from './subject-id-engine';

/**
 * Samples a level for one stratification factor based on expected probabilities.
 * Any positive weights are normalized to sum to 1 before sampling.
 * Falls back to uniform sampling only when no positive weights are present
 * (all values are undefined, zero, or negative).
 */
function sampleLevel(
  levels: string[],
  expectedProbabilities: (number | undefined)[],
  rng: seedrandom.PRNG
): string {
  if (levels.length === 0) {
    throw new Error('Cannot sample a level from an empty levels array.');
  }

  const explicitSum = expectedProbabilities.reduce(
    (sum: number, p) => sum + (p !== undefined && p > 0 ? p : 0),
    0
  );

  let probs: number[];

  if (explicitSum > 1.0) {
    // Normalize explicit to exactly 1.0, undefined get 0
    probs = expectedProbabilities.map(p => (p !== undefined && p > 0 ? p / explicitSum : 0));
  } else if (explicitSum === 1.0) {
    // Exact sum, undefined get 0
    probs = expectedProbabilities.map(p => (p !== undefined && p > 0 ? p : 0));
  } else if (explicitSum > 0 && explicitSum < 1.0) {
    // Distribute remainder equally among undefined levels
    const undefinedCount = expectedProbabilities.filter(p => p === undefined).length;
    if (undefinedCount > 0) {
      const remainder = 1.0 - explicitSum;
      const share = remainder / undefinedCount;
      probs = expectedProbabilities.map(p => (p !== undefined && p > 0 ? p : (p === undefined ? share : 0)));
    } else {
      // All levels defined but sum < 1.0, normalize proportionally
      probs = expectedProbabilities.map(p => (p !== undefined && p > 0 ? p / explicitSum : 0));
    }
  } else {
    // No explicit positive probabilities, distribute evenly
    probs = levels.map(() => 1 / levels.length);
  }

  const r = rng();
  let cumulative = 0;
  for (let i = 0; i < levels.length; i++) {
    cumulative += probs[i];
    if (r < cumulative) return levels[i];
  }
  return levels[levels.length - 1];
}

/**
 * Computes the Pocock-Simon imbalance score for assigning arm `candidateArmId`
 * to a subject with covariate profile `subjectProfile`.
 *
 * Score = sum over all factors of: range of arm counts (max - min) after the
 * hypothetical assignment, considering only levels present in the subject.
 */
function computeImbalanceScore(
  candidateArmId: string,
  arms: TreatmentArm[],
  subjectProfile: Record<string, string>,
  marginals: Map<string, Map<string, Map<string, number>>>
): number {
  let totalScore = 0;
  for (const [factorId, levelValue] of Object.entries(subjectProfile)) {
    const factorMarginals = marginals.get(factorId);
    if (!factorMarginals) continue;
    const levelMarginals = factorMarginals.get(levelValue);
    if (!levelMarginals) continue;

    let min = Infinity;
    let max = -Infinity;
    for (const arm of arms) {
      const count = (levelMarginals.get(arm.id) ?? 0) + (arm.id === candidateArmId ? 1 : 0);
      const normalizedCount = count / arm.ratio;
      if (normalizedCount < min) min = normalizedCount;
      if (normalizedCount > max) max = normalizedCount;
    }
    totalScore += max - min;
  }
  return totalScore;
}

/**
 * Generates a randomization schema using the Pocock-Simon minimization method.
 *
 * 1. Simulates N virtual subjects by sampling factor levels from user-defined distributions.
 * 2. For each subject, computes the imbalance score for each arm.
 * 3. The preferred arm(s) - those with the minimum imbalance score - are assigned with
 *    probability p; remaining probability (1-p) is shared equally among non-preferred arms.
 * 4. When multiple arms tie for minimum, one is chosen uniformly at random.
 */
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

  const basePerSite = Math.floor(totalSampleSize / sites.length);
  const remainder = totalSampleSize % sites.length;

  // Precompute probability vectors per factor (once, outside the site/subject loops).
  const factorProbVectors = new Map<string, (number | undefined)[]>();
  for (const factor of strata) {
    const levelDetailsByName = new Map(
      (factor.levelDetails ?? []).map(d => [d.name, d.expectedProbability] as const)
    );
    factorProbVectors.set(
      factor.id,
      factor.levels.map(levelName => levelDetailsByName.get(levelName))
    );
  }

  for (let siteIdx = 0; siteIdx < sites.length; siteIdx++) {
    const site = sites[siteIdx];
    const siteN = basePerSite + (siteIdx < remainder ? 1 : 0);

    // marginals[factorId][levelValue][armId] = count
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

    let siteSubjectCount = 0;

    for (let i = 0; i < siteN; i++) {
      const subjectProfile: Record<string, string> = {};
      const stratum: Record<string, string> = {};
      for (const factor of strata) {
        const rawProbs = factorProbVectors.get(factor.id) ?? factor.levels.map(() => undefined);
        const level = sampleLevel(factor.levels, rawProbs, rng);
        subjectProfile[factor.id] = level;
        stratum[factor.id] = level;
      }

      let minScore = Infinity;
      const armScores: number[] = [];
      for (const arm of arms) {
        const score = computeImbalanceScore(arm.id, arms, subjectProfile, marginals);
        armScores.push(score);
        if (score < minScore) minScore = score;
      }

      const preferred: TreatmentArm[] = [];
      const nonPreferred: TreatmentArm[] = [];
      for (let j = 0; j < arms.length; j++) {
        const arm = arms[j];
        if (armScores[j] === minScore) {
          preferred.push(arm);
        } else {
          nonPreferred.push(arm);
        }
      }

      let assignedArm: TreatmentArm;

      const selectWeightedArm = (candidates: TreatmentArm[]): TreatmentArm => {
        const totalWeight = candidates.reduce((sum, arm) => sum + arm.ratio, 0);
        if (totalWeight === 0) {
          throw new Error('Total weight of tied arms is 0. Cannot select an arm.');
        }

        let rVal = rng() * totalWeight;
        for (const arm of candidates) {
          rVal -= arm.ratio;
          if (rVal <= 0) {
            return arm;
          }
        }
        return candidates[candidates.length - 1];
      };

      if (preferred.length === arms.length || nonPreferred.length === 0) {
        assignedArm = selectWeightedArm(preferred);
      } else {
        const r = rng();
        if (r < p) {
          assignedArm = selectWeightedArm(preferred);
        } else {
          assignedArm = selectWeightedArm(nonPreferred);
        }
      }

      for (const factor of strata) {
        const levelValue = subjectProfile[factor.id];
        if (levelValue) {
          marginals.get(factor.id)?.get(levelValue)?.set(
            assignedArm.id,
            (marginals.get(factor.id)?.get(levelValue)?.get(assignedArm.id) ?? 0) + 1
          );
        }
      }

      siteSubjectCount++;
      const stratumCode = strata.map(s => (stratum[s.id] || '').substring(0, 3).toUpperCase()).join('-');

      const subjectId = generateSubjectId(
        config.subjectIdMask,
        { site, stratumCode, sequence: siteSubjectCount },
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
  }

  return schema;
}
