import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  RandomizationConfig,
  RandomizationResult
} from '../core/models/randomization.model';
import { RandomizationService } from './randomization.service';
import { ToastService } from '../../core/services/toast.service';
import { computeAuditHash } from './core/crypto-hash';
import type {
  GenerationCommand,
  MonteCarloCommand,
  MonteCarloProgressPayload,
  MonteCarloSuccessPayload,
  WorkerResponse
} from './worker/worker-protocol';

/**
 * RandomizationEngineFacade
 *
 * Single access point for all randomization operations.  UI components must
 * inject this facade instead of `RandomizationService` directly.
 *
 * In the browser, computation is offloaded to a dedicated Web Worker so the
 * main thread remains responsive during heavy schema generation.  In SSR
 * (server-side rendering) contexts where `Worker` is unavailable, execution
 * falls back to the synchronous `RandomizationService`.
 */
@Injectable({ providedIn: 'root' })
export class RandomizationEngineFacade {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly randomizationService = inject(RandomizationService);
  private readonly toastService = inject(ToastService);

  private worker: Worker | null = null;
  private pendingCallbacks = new Map<
    string,
    { resolve: (r: RandomizationResult) => void | Promise<void>; reject: (e: unknown) => void }
  >();

  private pendingMonteCarloCallbacks = new Map<
    string,
    {
      onProgress: (p: MonteCarloProgressPayload) => void;
      onSuccess: (r: MonteCarloSuccessPayload) => void;
      onError: (e: unknown) => void;
    }
  >();

  // -------------------------------------------------------------------------
  // Public state signals (mirrors the former GeneratorStateService API)
  // -------------------------------------------------------------------------

  readonly config = signal<RandomizationConfig | null>(null);
  readonly results = signal<RandomizationResult | null>(null);
  readonly isGenerating = signal(false);
  readonly error = signal<string | null>(null);

  // UI state
  readonly showCodeGenerator = signal(false);
  readonly codeLanguage = signal<'R' | 'SAS' | 'Python' | 'STATA'>('R');

  // Monte Carlo state
  readonly isMonteCarloRunning = signal(false);
  readonly monteCarloProgress = signal(0);
  readonly monteCarloResults = signal<MonteCarloSuccessPayload | null>(null);
  readonly showMonteCarloModal = signal(false);

  constructor() {
    if (this.isBrowser) {
      this.initWorker();
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  generateSchema(newConfig: RandomizationConfig): void {
    this.config.set(newConfig);
    this.isGenerating.set(true);
    this.error.set(null);
    this.results.set(null);

    if (this.worker) {
      this.dispatchToWorker(newConfig);
    } else {
      // SSR or Worker unavailable – fall back to synchronous in-thread service
      this.randomizationService.generateSchema(newConfig).subscribe({
        next: async res => {
          const hash = await computeAuditHash(res);
          const resultWithHash: RandomizationResult = {
            ...res,
            metadata: { ...res.metadata, auditHash: hash }
          };
          this.results.set(resultWithHash);
          this.isGenerating.set(false);
          this.toastService.showSuccess('Schema successfully generated!');
        },
        error: err => {
          const message = err.error?.error ?? 'An error occurred during schema generation.';
          this.error.set(message);
          this.isGenerating.set(false);
          this.toastService.showError(message);
        }
      });
    }
  }

  clearResults(): void {
    this.results.set(null);
    this.error.set(null);
  }

  openCodeGenerator(config: RandomizationConfig, language: 'R' | 'SAS' | 'Python' | 'STATA'): void {
    this.config.set(config);
    this.codeLanguage.set(language);
    this.showCodeGenerator.set(true);
  }

  closeCodeGenerator(): void {
    this.showCodeGenerator.set(false);
  }

  runMonteCarlo(config: RandomizationConfig): void {
    this.isMonteCarloRunning.set(true);
    this.monteCarloProgress.set(0);
    this.monteCarloResults.set(null);
    this.showMonteCarloModal.set(true);

    if (!this.worker) {
      this.isMonteCarloRunning.set(false);
      this.showMonteCarloModal.set(false);
      return;
    }

    const id = Math.random().toString(36).substring(2);

    this.pendingMonteCarloCallbacks.set(id, {
      onProgress: (p: MonteCarloProgressPayload) => {
        this.monteCarloProgress.set(
          Math.round((p.iterationsCompleted / p.totalIterations) * 100)
        );
      },
      onSuccess: (r: MonteCarloSuccessPayload) => {
        this.monteCarloResults.set(r);
        this.isMonteCarloRunning.set(false);
        this.monteCarloProgress.set(100);
      },
      onError: () => {
        this.isMonteCarloRunning.set(false);
        this.showMonteCarloModal.set(false);
      }
    });

    const command: MonteCarloCommand = { id, command: 'START_MONTE_CARLO', payload: config };
    this.worker.postMessage(command);
  }

  closeMonteCarloModal(): void {
    this.showMonteCarloModal.set(false);
    this.monteCarloResults.set(null);
    this.monteCarloProgress.set(0);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private initWorker(): void {
    try {
      this.worker = new Worker(
        new URL('./worker/randomization-engine.worker', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, type, payload } = event.data;

        // Route Monte Carlo messages
        if (type === 'MONTE_CARLO_PROGRESS') {
          const mc = this.pendingMonteCarloCallbacks.get(id);
          if (mc) mc.onProgress(payload as MonteCarloProgressPayload);
          return;
        }
        if (type === 'MONTE_CARLO_SUCCESS') {
          const mc = this.pendingMonteCarloCallbacks.get(id);
          if (mc) {
            this.pendingMonteCarloCallbacks.delete(id);
            mc.onSuccess(payload as MonteCarloSuccessPayload);
          }
          return;
        }

        // Route standard generation messages
        const callbacks = this.pendingCallbacks.get(id);
        if (!callbacks) return;
        this.pendingCallbacks.delete(id);

        if (type === 'GENERATION_SUCCESS') {
          callbacks.resolve(payload as RandomizationResult);
        } else {
          callbacks.reject(payload);
        }
      };

      this.worker.onerror = (err: ErrorEvent) => {
        console.error('Randomization worker error:', err);
        // Reject all pending callbacks
        this.pendingCallbacks.forEach(cb =>
          cb.reject({ error: { error: 'Worker encountered an unexpected error.' } })
        );
        this.pendingCallbacks.clear();

        this.pendingMonteCarloCallbacks.forEach(mc =>
          mc.onError({ error: { error: 'Worker encountered an unexpected error.' } })
        );
        this.pendingMonteCarloCallbacks.clear();
      };
    } catch {
      // Worker construction failed (e.g. in environments that block workers)
      this.worker = null;
    }
  }

  private dispatchToWorker(config: RandomizationConfig): void {
    const id = Math.random().toString(36).substring(2);

    this.pendingCallbacks.set(id, {
      resolve: async result => {
        const hash = await computeAuditHash(result);
        const resultWithHash: RandomizationResult = {
          ...result,
          metadata: { ...result.metadata, auditHash: hash }
        };
        this.results.set(resultWithHash);
        this.isGenerating.set(false);
        this.toastService.showSuccess('Schema successfully generated!');
      },
      reject: err => {
        const errPayload = err as { error?: { error?: string } };
        const message =
          errPayload?.error?.error ?? 'An error occurred during schema generation.';
        this.error.set(message);
        this.isGenerating.set(false);
        this.toastService.showError(message);
      }
    });

    const command: GenerationCommand = { id, command: 'START_GENERATION', payload: config };
    this.worker!.postMessage(command);
  }
}
