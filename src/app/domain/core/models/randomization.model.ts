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
