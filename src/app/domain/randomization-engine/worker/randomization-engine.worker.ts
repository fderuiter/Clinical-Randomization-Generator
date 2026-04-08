/// <reference lib="webworker" />

import { generateRandomizationSchema } from '../core/randomization-algorithm';
import type { GenerationCommand, WorkerResponse } from './worker-protocol';

addEventListener('message', (event: MessageEvent<GenerationCommand>) => {
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
  }
});
