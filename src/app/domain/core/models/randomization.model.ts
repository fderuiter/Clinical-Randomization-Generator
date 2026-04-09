export interface TreatmentArm {
  id: string;
  name: string;
  ratio: number;
}

export interface StratificationFactor {
  id: string;
  name: string;
  levels: string[];
}

export interface StratumCap {
  levels: string[];
  cap: number;
}

export type RandomizationMethod = 'PERMUTED_BLOCK' | 'MINIMIZATION';

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
  /** Randomization strategy. Defaults to 'PERMUTED_BLOCK' for backward compatibility. */
  randomizationMethod?: RandomizationMethod;
  /** Probability (0.5–1.0) of assigning the treatment that minimizes imbalance. Used only for MINIMIZATION. */
  biasedCoinProbability?: number;
  /** Total number of subjects to simulate. Used only for MINIMIZATION. */
  targetEnrollment?: number;
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
  };
  schema: GeneratedSchema[];
}
