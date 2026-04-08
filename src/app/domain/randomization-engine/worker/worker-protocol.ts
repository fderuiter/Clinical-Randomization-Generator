import { RandomizationConfig, RandomizationResult } from '../../core/models/randomization.model';

/** Discriminated union of commands sent from the main thread to the worker. */
export type WorkerCommandType = 'START_GENERATION';

/** Discriminated union of responses sent from the worker to the main thread. */
export type WorkerResponseType =
  | 'GENERATION_SUCCESS'
  | 'GENERATION_ERROR'
  | 'PROGRESS_UPDATE';

export interface WorkerCommand<T = unknown> {
  /** Unique correlation identifier so callers can match responses to requests. */
  id: string;
  command: WorkerCommandType;
  payload: T;
}

export interface WorkerResponse<T = unknown> {
  /** Mirrors the request `id` so the caller can route the response correctly. */
  id: string;
  type: WorkerResponseType;
  payload: T;
}

/** Strongly-typed command for starting schema generation. */
export type GenerationCommand = WorkerCommand<RandomizationConfig>;

/** Strongly-typed success response containing the generated result. */
export type GenerationSuccessResponse = WorkerResponse<RandomizationResult>;

/** Strongly-typed error response containing the error payload. */
export type GenerationErrorResponse = WorkerResponse<{ error: { error: string } }>;
