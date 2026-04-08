import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  RandomizationConfig,
  RandomizationResult
} from '../core/models/randomization.model';
import { RandomizationService } from './randomization.service';
import type { GenerationCommand, WorkerResponse } from './worker/worker-protocol';

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

  private worker: Worker | null = null;
  private pendingCallbacks = new Map<
    string,
    { resolve: (r: RandomizationResult) => void; reject: (e: unknown) => void }
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
  readonly codeLanguage = signal<'R' | 'SAS' | 'Python'>('R');

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
        next: res => {
          this.results.set(res);
          this.isGenerating.set(false);
        },
        error: err => {
          this.error.set(err.error?.error ?? 'An error occurred during schema generation.');
          this.isGenerating.set(false);
        }
      });
    }
  }

  clearResults(): void {
    this.results.set(null);
    this.error.set(null);
  }

  openCodeGenerator(config: RandomizationConfig, language: 'R' | 'SAS' | 'Python'): void {
    this.config.set(config);
    this.codeLanguage.set(language);
    this.showCodeGenerator.set(true);
  }

  closeCodeGenerator(): void {
    this.showCodeGenerator.set(false);
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
      };
    } catch {
      // Worker construction failed (e.g. in environments that block workers)
      this.worker = null;
    }
  }

  private dispatchToWorker(config: RandomizationConfig): void {
    const id = Math.random().toString(36).substring(2);

    this.pendingCallbacks.set(id, {
      resolve: result => {
        this.results.set(result);
        this.isGenerating.set(false);
      },
      reject: err => {
        const errPayload = err as { error?: { error?: string } };
        this.error.set(
          errPayload?.error?.error ?? 'An error occurred during schema generation.'
        );
        this.isGenerating.set(false);
      }
    });

    const command: GenerationCommand = { id, command: 'START_GENERATION', payload: config };
    this.worker!.postMessage(command);
  }
}
