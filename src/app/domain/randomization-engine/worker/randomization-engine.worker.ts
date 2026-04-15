/// <reference lib="webworker" />

import { generateRandomizationSchema, generateCryptoSeed } from '../core/randomization-algorithm';
import { mulberry32 } from './attrition-prng';
import type {
  MonteCarloPayload,
  MonteCarloProgressPayload,
  MonteCarloSuccessPayload,
  WorkerResponse
} from './worker-protocol';
import type { RandomizationConfig } from '../../core/models/randomization.model';

/**
 * Truly-discriminated command union: TypeScript narrows `payload` by `command` value,
 * eliminating the need for unsafe `as` casts in the message handler.
 */
type IncomingCommand =
  | { id: string; command: 'START_GENERATION'; payload: RandomizationConfig }
  | { id: string; command: 'START_MONTE_CARLO'; payload: MonteCarloPayload };

addEventListener('message', (event: MessageEvent<IncomingCommand>) => {
  const { id, command, payload } = event.data;

  if (command === 'START_GENERATION') {
    try {
      const result = generateRandomizationSchema(payload);
      const response: WorkerResponse = {
        id,
        type: 'GENERATION_SUCCESS',
        payload: result
      };
      postMessage(response);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Internal error during randomization';
      const response: WorkerResponse = {
        id,
        type: 'GENERATION_ERROR',
        payload: { error: { error: msg } }
      };
      postMessage(response);
    }
  } else if (command === 'START_MONTE_CARLO') {
    runMonteCarlo(id, payload);
  }
});

function runMonteCarlo(id: string, { config, attritionRate }: MonteCarloPayload): void {
  const TOTAL_ITERATIONS = 10_000;
  const PROGRESS_INTERVAL = 500;
  // NaN guard: non-finite values (e.g. NaN from empty input) are normalised to 0.
  const normalizedAttritionRate = Number.isFinite(attritionRate) ? attritionRate : 0;
  const clampedAttritionRate = Math.max(0, Math.min(50, normalizedAttritionRate));
  const dropoutProbability = clampedAttritionRate / 100;

  // Initialise per-arm accumulators (before and after attrition)
  const armCounts: Record<string, number> = {};
  const retainedArmCounts: Record<string, number> = {};
  for (const arm of config.arms) {
    armCounts[arm.id] = 0;
    retainedArmCounts[arm.id] = 0;
  }

  let totalSubjects = 0;
  let totalRetained = 0;

  for (let i = 0; i < TOTAL_ITERATIONS; i++) {
    // Replace the user's seed with a cryptographically random one each iteration
    const iterationConfig = { ...config, seed: generateCryptoSeed() };

    try {
      const result = generateRandomizationSchema(iterationConfig);

      // Deterministic PRNG for attrition: seeded by the iteration index so that
      // results are perfectly reproducible for any given attrition rate value.
      // The multiplier (1_000_003) and offset (7) are coprime primes chosen to spread
      // seeds evenly across the 32-bit space and avoid low-entropy seed clustering.
      const rng = dropoutProbability > 0 ? mulberry32(i * 1_000_003 + 7) : null;

      for (const subject of result.schema) {
        armCounts[subject.treatmentArmId] = (armCounts[subject.treatmentArmId] ?? 0) + 1;
        totalSubjects++;

        // Apply attrition filter: subject is retained when random threshold is not met
        const retained = rng === null || rng() >= dropoutProbability;
        if (retained) {
          retainedArmCounts[subject.treatmentArmId] = (retainedArmCounts[subject.treatmentArmId] ?? 0) + 1;
          totalRetained++;
        }
      }
    } catch {
      // Skip invalid iterations (e.g., edge-case config errors) without crashing the simulation
    }

    // Emit progress every PROGRESS_INTERVAL iterations
    if ((i + 1) % PROGRESS_INTERVAL === 0) {
      const progressPayload: MonteCarloProgressPayload = {
        iterationsCompleted: i + 1,
        totalIterations: TOTAL_ITERATIONS
      };
      const progressResponse: WorkerResponse<MonteCarloProgressPayload> = {
        id,
        type: 'MONTE_CARLO_PROGRESS',
        payload: progressPayload
      };
      postMessage(progressResponse);
    }
  }

  // expectedCount is always based on total simulated (pre-attrition basis) so that
  // the algorithm's inherent fairness can be assessed independently of attrition.
  // expectedRetainedCount is based on total retained subjects for post-attrition analysis.
  const totalRatio = config.arms.reduce((sum, arm) => sum + arm.ratio, 0);
  const arms = config.arms.map(arm => ({
    armId: arm.id,
    armName: arm.name,
    ratio: arm.ratio,
    expectedCount: Math.round((arm.ratio / totalRatio) * totalSubjects),
    actualCount: armCounts[arm.id] ?? 0,
    expectedRetainedCount: Math.round((arm.ratio / totalRatio) * totalRetained),
    retainedCount: retainedArmCounts[arm.id] ?? 0
  }));

  const successPayload: MonteCarloSuccessPayload = {
    totalIterations: TOTAL_ITERATIONS,
    totalSubjectsSimulated: totalSubjects,
    totalRetainedSubjects: totalRetained,
    // Return the clamped rate so the UI always reflects the value actually used.
    attritionRate: clampedAttritionRate,
    arms
  };

  const successResponse: WorkerResponse<MonteCarloSuccessPayload> = {
    id,
    type: 'MONTE_CARLO_SUCCESS',
    payload: successPayload
  };
  postMessage(successResponse);
}
