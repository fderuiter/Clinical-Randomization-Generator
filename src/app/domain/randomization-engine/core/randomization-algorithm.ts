import seedrandom from 'seedrandom';
import {
  TreatmentArm,
  RandomizationConfig,
  GeneratedSchema,
  RandomizationResult,
  BlockRule
} from '../../core/models/randomization.model';
import { generateSubjectId } from './subject-id-engine';
import { generateMinimization } from './minimization-algorithm';

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
// Hierarchical Block Strategy helpers
// ---------------------------------------------------------------------------

/**
 * Tracks per-stratum block-selection state used by the hierarchical strategy
 * engine to enforce FIXED_SEQUENCE ordering and RANDOM_POOL size limits.
 */
interface BlockState {
  /** Next index for FIXED_SEQUENCE mode (cycles back to 0 when exhausted). */
  sequenceIndex: number;
  /** How many times each block size has been used (for RANDOM_POOL limits). */
  usageCounts: Map<number, number>;
}

/**
 * Resolves which BlockRule applies for a given (site, stratumCode) pair using
 * the priority order:
 *  1. stratumBlockOverrides[stratumCode]
 *  2. siteBlockOverrides[site]
 *  3. globalBlockStrategy
 *  4. Fallback: RANDOM_POOL built from the flat `blockSizes` array.
 */
function resolveBlockRule(config: RandomizationConfig, site: string, stratumCode: string): BlockRule {
  if (config.stratumBlockOverrides?.[stratumCode]) {
    return config.stratumBlockOverrides[stratumCode];
  }
  if (config.siteBlockOverrides?.[site]) {
    return config.siteBlockOverrides[site];
  }
  if (config.globalBlockStrategy) {
    return config.globalBlockStrategy;
  }
  return { selectionType: 'RANDOM_POOL', sizes: config.blockSizes };
}

/**
 * Selects the next block size according to the resolved rule, updating the
 * provided state object in place.
 *
 * - FIXED_SEQUENCE: returns `rule.sizes[state.sequenceIndex % rule.sizes.length]`
 *   and advances the index.
 * - RANDOM_POOL: filters out exhausted sizes (those that have hit their limit),
 *   then uses the PRNG to pick from the remaining pool. Falls back to the full
 *   sizes array if every size has been exhausted.
 */
function selectBlockSize(rule: BlockRule, state: BlockState, rng: seedrandom.PRNG): number {
  if (rule.selectionType === 'FIXED_SEQUENCE') {
    const size = rule.sizes[state.sequenceIndex % rule.sizes.length];
    state.sequenceIndex++;
    return size;
  }

  // RANDOM_POOL: respect optional per-size limits
  let available = rule.sizes;
  if (rule.limits) {
    const filtered = rule.sizes.filter(size => {
      const limit = rule.limits![String(size)];
      if (limit === undefined) return true;
      return (state.usageCounts.get(size) ?? 0) < limit;
    });
    if (filtered.length > 0) available = filtered;
    // If all sizes are exhausted, fall back to the full pool (soft-cap behaviour).
  }

  const idx = Math.floor(rng() * available.length);
  const size = available[idx];
  state.usageCounts.set(size, (state.usageCounts.get(size) ?? 0) + 1);
  return size;
}

/** Returns a fresh, zeroed BlockState. */
function newBlockState(): BlockState {
  return { sequenceIndex: 0, usageCounts: new Map() };
}

/**
 * Collect every block size referenced across all block rules in the config so
 * they can be validated against the total treatment ratio.
 */
function collectAllBlockSizes(config: RandomizationConfig): number[] {
  const sizes = new Set<number>(config.blockSizes);
  const addRule = (rule: BlockRule) => rule.sizes.forEach(s => sizes.add(s));
  if (config.globalBlockStrategy) addRule(config.globalBlockStrategy);
  if (config.siteBlockOverrides) Object.values(config.siteBlockOverrides).forEach(addRule);
  if (config.stratumBlockOverrides) Object.values(config.stratumBlockOverrides).forEach(addRule);
  return [...sizes];
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
      const stratumCode = computeStratumCode(resolvedConfig.strata, stratum);

      let stratumSubjectCount = 0;
      let blockNumber = 1;

      // Resolve which block rule to apply and create a fresh tracking state.
      const rule = resolveBlockRule(resolvedConfig, site, stratumCode);
      const blockState = newBlockState();

      while (stratumSubjectCount < maxSubjectsPerStratum) {
        const blockSize = selectBlockSize(rule, blockState, rng);
        const block = buildBlock(resolvedConfig.arms, blockSize, totalRatio, rng);

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
  let hasFullyCappedFactor = false;
  for (const factor of resolvedConfig.strata) {
    const levelMap = new Map<string, number | undefined>();
    if (factor.levelDetails) {
      for (const detail of factor.levelDetails) {
        levelMap.set(detail.name, detail.marginalCap);
      }
    }
    marginalCapMap.set(factor.id, levelMap);

    // A fully-capped factor has a finite, non-negative cap on every one of its levels.
    // This guarantees every stratum combination containing this factor is eventually pruned.
    const allLevelsCapped =
      factor.levels.length > 0 &&
      factor.levels.every(lvl => {
        const cap = levelMap.get(lvl);
        return Number.isFinite(cap) && (cap as number) >= 0;
      });
    if (allLevelsCapped) {
      hasFullyCappedFactor = true;
    }
  }

  // Guard: MARGINAL_ONLY terminates only if every possible stratum combination contains
  // at least one capped level. Requiring one factor where ALL levels have a finite cap
  // guarantees this: every combination that includes that factor is eventually pruned.
  if (!hasFullyCappedFactor) {
    throw new Error(
      'MARGINAL_ONLY randomization requires at least one stratification factor with a finite ' +
      'marginalCap on every one of its levels to guarantee termination. ' +
      'Set a marginalCap for all levels of at least one stratum factor.'
    );
  }

  for (const site of resolvedConfig.sites) {
    let siteSubjectCount = 0;
    let blockNumber = 0;

    // Per-stratum block-selection state (FIXED_SEQUENCE index / RANDOM_POOL usage counts).
    const siteBlockStates = new Map<string, BlockState>();

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

      // Resolve block rule and pick a block size using the hierarchical strategy.
      const stratumCode = computeStratumCode(resolvedConfig.strata, stratum);
      const rule = resolveBlockRule(resolvedConfig, site, stratumCode);
      if (!siteBlockStates.has(stratumCode)) {
        siteBlockStates.set(stratumCode, newBlockState());
      }
      const blockSize = selectBlockSize(rule, siteBlockStates.get(stratumCode)!, rng);
      const block = buildBlock(resolvedConfig.arms, blockSize, totalRatio, rng);
      // Increment per generated block so downstream grouping/sorting (which uses
      // site|stratumCode|blockNumber) remains meaningful in MARGINAL_ONLY mode.
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

  // Validate block sizes from all rules (skip for minimization - block sizes don't apply).
  if (resolvedConfig.randomizationMethod !== 'MINIMIZATION') {
    for (const size of collectAllBlockSizes(resolvedConfig)) {
      if (size % totalRatio !== 0) {
        throw new Error(`Block size ${size} is not a multiple of total ratio ${totalRatio}`);
      }
    }
  }

  const schema: GeneratedSchema[] = [];
  /** Tracks all assigned subject IDs to prevent duplicates (relevant for {RND:n} tokens). */
  const usedSubjectIds = new Set<string>();

  if (resolvedConfig.randomizationMethod === 'MINIMIZATION') {
    schema.push(...generateMinimization(resolvedConfig, rng));
  } else if (resolvedConfig.capStrategy === 'MARGINAL_ONLY') {
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
