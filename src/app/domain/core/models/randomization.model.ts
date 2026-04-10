export interface TreatmentArm {
  id: string;
  name: string;
  ratio: number;
}

/** Optional per-level metadata used by the proportional and marginal cap strategies. */
export interface StratificationLevel {
  name: string;
  /** Percentage weight (0–100) used when capStrategy is 'PROPORTIONAL'. */
  targetPercentage?: number;
  /** Hard limit on the number of subjects with this level value when capStrategy is 'MARGINAL_ONLY'. */
  marginalCap?: number;
}

export interface StratificationFactor {
  id: string;
  name: string;
  levels: string[];
  /** Extended level metadata for proportional / marginal strategies. Parallel to `levels`. */
  levelDetails?: StratificationLevel[];
}

export interface StratumCap {
  levels: string[];
  cap: number;
}

/** Controls how per-stratum enrollment caps are defined and enforced. */
export type CapStrategy = 'MANUAL_MATRIX' | 'PROPORTIONAL' | 'MARGINAL_ONLY';

/**
 * Determines how the next block size is chosen within a resolved block rule.
 * - `RANDOM_POOL`: Randomly select from the available sizes (respecting optional limits).
 * - `FIXED_SEQUENCE`: Iterate through `sizes` in order, looping when exhausted.
 */
export type BlockSelectionType = 'RANDOM_POOL' | 'FIXED_SEQUENCE';

/**
 * A block-size rule that can be applied globally, per-site, or per-stratum.
 */
export interface BlockRule {
  selectionType: BlockSelectionType;
  /** Array of block sizes available for this rule. */
  sizes: number[];
  /**
   * Optional per-size usage caps for `RANDOM_POOL` mode.
   * Key = block size as a string (e.g. `"8"`), value = max number of times
   * that size may be used within the tracking scope for this rule.
   */
  limits?: Record<string, number>;
}

export interface RandomizationConfig {
  protocolId: string;
  studyName: string;
  phase: string;
  arms: TreatmentArm[];
  sites: string[];
  strata: StratificationFactor[];
  blockSizes: number[];
  stratumCaps: StratumCap[];
  seed: string;
  subjectIdMask: string;
  /** Cap calculation strategy. Defaults to 'MANUAL_MATRIX' when absent. */
  capStrategy?: CapStrategy;
  /** Total intended enrollment (used by 'PROPORTIONAL' strategy). */
  globalCap?: number;
  /**
   * Hierarchical block strategy – global default.
   * When present this supersedes the flat `blockSizes` array for size selection.
   */
  globalBlockStrategy?: BlockRule;
  /**
   * Per-site block rule overrides.
   * Key = Site ID (must match an entry in `sites`).
   */
  siteBlockOverrides?: Record<string, BlockRule>;
  /**
   * Per-stratum block rule overrides.
   * Key = Stratum Code computed by `computeStratumCode()` (e.g. `"MAL-U65-USA"`).
   */
  stratumBlockOverrides?: Record<string, BlockRule>;
}

export interface GeneratedSchema {
  subjectId: string;
  site: string;
  stratum: Record<string, string>;
  stratumCode: string;
  blockNumber: number;
  blockSize: number;
  treatmentArm: string;
  treatmentArmId: string;
}

export interface RandomizationResult {
  metadata: {
    protocolId: string;
    studyName: string;
    phase: string;
    seed: string;
    generatedAt: string;
    strata: StratificationFactor[];
    config: RandomizationConfig;
    auditHash: string;
  };
  schema: GeneratedSchema[];
}
