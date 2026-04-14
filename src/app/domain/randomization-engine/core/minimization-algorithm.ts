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
  const raw = expectedProbabilities.map(p => (p !== undefined && p > 0 ? p : 0));
  const total = raw.reduce((s, v) => s + v, 0);
  const probs = total > 0 ? raw.map(v => v / total) : levels.map(() => 1 / levels.length);

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
      if (count < min) min = count;
      if (count > max) max = count;
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

      const scores = arms.map(arm => ({
        arm,
        score: computeImbalanceScore(arm.id, arms, subjectProfile, marginals)
      }));

      const minScore = Math.min(...scores.map(s => s.score));
      const preferred = scores.filter(s => s.score === minScore).map(s => s.arm);
      const nonPreferred = scores.filter(s => s.score > minScore).map(s => s.arm);

      let assignedArm: TreatmentArm;
      if (preferred.length === arms.length || nonPreferred.length === 0) {
        assignedArm = preferred[Math.floor(rng() * preferred.length)];
      } else {
        const r = rng();
        if (r < p) {
          assignedArm = preferred[Math.floor(rng() * preferred.length)];
        } else {
          assignedArm = nonPreferred[Math.floor(rng() * nonPreferred.length)];
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
