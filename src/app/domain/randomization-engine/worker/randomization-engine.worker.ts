/// <reference lib="webworker" />

import { generateRandomizationSchema, generateCryptoSeed } from '../core/randomization-algorithm';
import { mulberry32 } from './attrition-prng';
import type {
  GenerationCommand,
  MonteCarloPayload,
  MonteCarloProgressPayload,
  MonteCarloSuccessPayload,
  WorkerResponse
} from './worker-protocol';
import type { RandomizationConfig } from '../../core/models/randomization.model';

type IncomingCommand = GenerationCommand | { id: string; command: 'START_MONTE_CARLO'; payload: MonteCarloPayload };

addEventListener('message', (event: MessageEvent<IncomingCommand>) => {
  const { id, command, payload } = event.data;

  if (command === 'START_GENERATION') {
    try {
      const result = generateRandomizationSchema(payload as RandomizationConfig);
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
    runMonteCarlo(id, payload as MonteCarloPayload);
  }
});

function runMonteCarlo(id: string, { config, attritionRate }: MonteCarloPayload): void {
  const TOTAL_ITERATIONS = 10_000;
  const PROGRESS_INTERVAL = 500;
  const dropoutProbability = Math.max(0, Math.min(50, attritionRate)) / 100;

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

  // Calculate expected counts based on pure ratio math (against total retained subjects)
  const totalRatio = config.arms.reduce((sum, arm) => sum + arm.ratio, 0);
  const baseTotal = dropoutProbability > 0 ? totalRetained : totalSubjects;
  const arms = config.arms.map(arm => ({
    armId: arm.id,
    armName: arm.name,
    ratio: arm.ratio,
    expectedCount: Math.round((arm.ratio / totalRatio) * baseTotal),
    actualCount: armCounts[arm.id] ?? 0,
    retainedCount: retainedArmCounts[arm.id] ?? 0
  }));

  const successPayload: MonteCarloSuccessPayload = {
    totalIterations: TOTAL_ITERATIONS,
    totalSubjectsSimulated: totalSubjects,
    totalRetainedSubjects: totalRetained,
    attritionRate,
    arms
  };

  const successResponse: WorkerResponse<MonteCarloSuccessPayload> = {
    id,
    type: 'MONTE_CARLO_SUCCESS',
    payload: successPayload
  };
  postMessage(successResponse);
}
