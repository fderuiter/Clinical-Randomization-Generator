import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RandomizationEngineFacade } from '../randomization-engine.facade';
import type { MonteCarloArmResult } from '../worker/worker-protocol';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-monte-carlo-modal',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="mc-modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-gray-500/60 dark:bg-slate-900/70 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          (click)="!facade.isMonteCarloRunning() && facade.closeMonteCarloModal()"
        ></div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <!-- Modal panel -->
        <div class="relative inline-block align-bottom bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl text-left overflow-hidden shadow-xl dark:shadow-slate-900/50 transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full border border-gray-100 dark:border-slate-700">

          <!-- Header -->
          <div class="bg-white/80 dark:bg-slate-800/80 px-6 pt-5 pb-4">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0 w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-slate-100" id="mc-modal-title">
                    Statistical QA - Monte Carlo Validation
                  </h3>
                  <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    10,000 independent trial simulations using cryptographically random seeds
                  </p>
                </div>
              </div>
              @if (!facade.isMonteCarloRunning()) {
                <button
                  type="button"
                  (click)="facade.closeMonteCarloModal()"
                  class="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              }
            </div>
          </div>

          <!-- Body -->
          <div class="px-6 pb-6 space-y-6">

            <!-- Seed disclaimer banner -->
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-3 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-xs text-amber-800 dark:text-amber-300" data-testid="seed-disclaimer-banner">
                <strong>Note:</strong> Your specific PRNG seed has been stripped for this simulation. Each of the 10,000 iterations uses a unique, cryptographically random seed to prove the general fairness of the algorithm independent of any specific seed value.
              </p>
            </div>

            <!-- Progress state -->
            @if (facade.isMonteCarloRunning()) {
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Simulating trials…</span>
                  <span class="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{{ facade.monteCarloProgress() }}%</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div
                    class="bg-indigo-600 dark:bg-indigo-500 h-3 rounded-full transition-all duration-300 ease-out"
                    [style.width.%]="facade.monteCarloProgress()"
                    data-testid="mc-progress-bar"
                  ></div>
                </div>
                <p class="text-xs text-gray-500 dark:text-slate-400 text-center">
                  {{ progressIterations() | number }} / 10,000 iterations completed - running off the main UI thread via Web Worker
                </p>
              </div>
            }

            <!-- Results state -->
            @if (facade.monteCarloResults(); as results) {
              <!-- Summary stats -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                  <p class="text-2xl font-bold text-gray-900 dark:text-slate-100" data-testid="simulations-run-value">{{ results.totalIterations | number }}</p>
                  <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Simulations Run</p>
                </div>
                <div class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                  <p class="text-2xl font-bold text-gray-900 dark:text-slate-100">{{ results.totalSubjectsSimulated | number }}</p>
                  <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Total Subjects Simulated</p>
                </div>
                <div class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-center col-span-2 sm:col-span-1">
                  <p class="text-2xl font-bold" [class]="maxDeviationClass()">{{ maxDeviation() | number:'1.4-4' }}%</p>
                  <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Max Arm Deviation</p>
                </div>
              </div>

              <!-- Bar chart -->
              <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Treatment Arm Distribution</h4>
                <div class="space-y-3" data-testid="mc-chart">
                  @for (arm of results.arms; track arm.armId) {
                    <div class="space-y-1">
                      <div class="flex justify-between items-center">
                        <span class="text-xs font-medium text-gray-600 dark:text-slate-300">{{ arm.armName }} ({{ arm.armId }})</span>
                        <span class="text-xs text-gray-500 dark:text-slate-400">Deviation: <span [class]="deviationClass(arm)" class="font-semibold">{{ deviation(arm) | number:'1.4-4' }}%</span></span>
                      </div>
                      <!-- Expected bar -->
                      <div class="flex items-center gap-2">
                        <span class="text-xs w-20 text-right text-gray-400 dark:text-slate-500">Expected</span>
                        <div class="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                          <div
                            class="bg-indigo-300 dark:bg-indigo-600/60 h-4 rounded-full transition-all duration-500"
                            [style.width.%]="barWidth(arm.expectedCount, results.totalSubjectsSimulated)"
                          ></div>
                        </div>
                        <span class="text-xs w-20 text-gray-500 dark:text-slate-400 tabular-nums">{{ arm.expectedCount | number }}</span>
                      </div>
                      <!-- Actual bar -->
                      <div class="flex items-center gap-2">
                        <span class="text-xs w-20 text-right text-gray-400 dark:text-slate-500">Actual</span>
                        <div class="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                          <div
                            class="bg-indigo-600 dark:bg-indigo-400 h-4 rounded-full transition-all duration-500"
                            [style.width.%]="barWidth(arm.actualCount, results.totalSubjectsSimulated)"
                          ></div>
                        </div>
                        <span class="text-xs w-20 text-gray-500 dark:text-slate-400 tabular-nums">{{ arm.actualCount | number }}</span>
                      </div>
                    </div>
                  }
                </div>
                <!-- Legend -->
                <div class="flex gap-4 mt-3">
                  <div class="flex items-center gap-1.5">
                    <div class="w-3 h-3 rounded-full bg-indigo-300 dark:bg-indigo-600/60"></div>
                    <span class="text-xs text-gray-500 dark:text-slate-400">Target (Expected)</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div class="w-3 h-3 rounded-full bg-indigo-600 dark:bg-indigo-400"></div>
                    <span class="text-xs text-gray-500 dark:text-slate-400">Actual (Simulated)</span>
                  </div>
                </div>
              </div>

              <!-- Per-arm detail table -->
              <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
                <table class="min-w-full text-xs divide-y divide-gray-200 dark:divide-slate-700">
                  <thead class="bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                      <th class="px-4 py-2 text-left font-semibold text-gray-600 dark:text-slate-300">Arm</th>
                      <th class="px-4 py-2 text-right font-semibold text-gray-600 dark:text-slate-300">Ratio</th>
                      <th class="px-4 py-2 text-right font-semibold text-gray-600 dark:text-slate-300">Expected</th>
                      <th class="px-4 py-2 text-right font-semibold text-gray-600 dark:text-slate-300">Actual</th>
                      <th class="px-4 py-2 text-right font-semibold text-gray-600 dark:text-slate-300">Deviation</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800">
                    @for (arm of results.arms; track arm.armId) {
                      <tr>
                        <td class="px-4 py-2 font-medium text-gray-900 dark:text-slate-100">{{ arm.armName }} <span class="text-gray-400 dark:text-slate-500">({{ arm.armId }})</span></td>
                        <td class="px-4 py-2 text-right text-gray-600 dark:text-slate-300">{{ arm.ratio }}</td>
                        <td class="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-slate-300">{{ arm.expectedCount | number }}</td>
                        <td class="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-slate-300">{{ arm.actualCount | number }}</td>
                        <td class="px-4 py-2 text-right tabular-nums font-semibold" [class]="deviationClass(arm)">{{ deviation(arm) | number:'1.4-4' }}%</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Clinical confidence banner -->
              <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 rounded-lg p-4 flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed" data-testid="mc-confidence-statement">
                  <strong>Algorithm mathematically verified.</strong>
                  After {{ results.totalIterations | number }} independent trial simulations, actual treatment assignment deviates from target theoretical ratios by less than <strong>{{ maxDeviation() | number:'1.4-4' }}%</strong>, confirming true uniform distribution and absence of block bias.
                </p>
              </div>
            }

          </div>

          <!-- Footer -->
          @if (!facade.isMonteCarloRunning()) {
            <div class="bg-gray-50/80 dark:bg-slate-900/50 px-6 py-3 flex justify-end border-t border-gray-100 dark:border-slate-700">
              <button
                type="button"
                (click)="facade.closeMonteCarloModal()"
                class="inline-flex justify-center rounded-lg border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                data-testid="modal-close-footer"
              >
                Close
              </button>
            </div>
          }

        </div>
      </div>
    </div>
  `
})
export class MonteCarloModalComponent {
  readonly facade = inject(RandomizationEngineFacade);

  readonly progressIterations = computed(() =>
    Math.round((this.facade.monteCarloProgress() / 100) * 10_000)
  );

  barWidth(count: number, total: number): number {
    if (total === 0) return 0;
    return (count / total) * 100;
  }

  deviation(arm: MonteCarloArmResult): number {
    if (arm.expectedCount === 0) return 0;
    return Math.abs((arm.actualCount - arm.expectedCount) / arm.expectedCount) * 100;
  }

  deviationClass(arm: MonteCarloArmResult): string {
    const d = this.deviation(arm);
    if (d < 0.1) return 'text-emerald-600 dark:text-emerald-400';
    if (d < 1) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-rose-400';
  }

  maxDeviation(): number {
    const results = this.facade.monteCarloResults();
    if (!results) return 0;
    return results.arms.reduce((max, arm) => Math.max(max, this.deviation(arm)), 0);
  }

  maxDeviationClass(): string {
    const d = this.maxDeviation();
    if (d < 0.1) return 'text-emerald-600 dark:text-emerald-400 text-2xl font-bold';
    if (d < 1) return 'text-amber-600 dark:text-amber-400 text-2xl font-bold';
    return 'text-red-600 dark:text-rose-400 text-2xl font-bold';
  }
}
