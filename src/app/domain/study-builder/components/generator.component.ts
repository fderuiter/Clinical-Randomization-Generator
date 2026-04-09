import { ChangeDetectionStrategy, Component, inject, effect, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ConfigFormComponent } from './config-form.component';
import { ResultsGridComponent } from '../../schema-management/components/results-grid.component';
import { CodeGeneratorModalComponent } from '../../schema-management/components/code-generator-modal.component';
import { MonteCarloModalComponent } from '../../randomization-engine/components/monte-carlo-modal.component';
import { SchemaAnalyticsDashboardComponent } from '../../schema-management/components/schema-analytics-dashboard.component';
import { BalanceVerificationComponent } from '../../schema-management/components/balance-verification.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';

type ResultsTab = 'grid' | 'balance';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-generator',
  imports: [ConfigFormComponent, ResultsGridComponent, CodeGeneratorModalComponent, MonteCarloModalComponent, SchemaAnalyticsDashboardComponent, BalanceVerificationComponent],
  template: `
    <div class="space-y-8">
      <!-- Intro -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100">Study-Agnostic Randomization</h2>
        </div>
        <p class="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
          Configure your clinical trial parameters below to generate a statistically sound, reproducible, and balanced treatment allocation schema. 
          The system uses a seeded Fisher-Yates shuffle for stratified block randomization.
        </p>
      </div>

      <!-- Configuration Form -->
      <app-config-form></app-config-form>

      <!-- Loading State -->
      @if (state.isGenerating()) {
        <div class="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
          <svg class="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-600 dark:text-slate-400 font-medium">Generating schema...</p>
        </div>
      }

      <!-- Results Section -->
      @if (state.results() && !state.isGenerating()) {
        <div id="results-section" class="space-y-4">

          <!-- ── Tab Navigation ──────────────────────────────────────── -->
          <div class="flex gap-1 border-b border-gray-200 dark:border-slate-700">
            <button
              (click)="activeTab.set('grid')"
              class="px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors"
              [class]="activeTab() === 'grid'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500'"
              aria-label="Schema Grid tab"
            >
              Schema Grid
            </button>
            <button
              (click)="activeTab.set('balance')"
              class="px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors"
              [class]="activeTab() === 'balance'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500'"
              aria-label="Balance Verification tab"
            >
              Balance Verification
            </button>
          </div>

          <!-- ── Schema Grid tab ─────────────────────────────────────── -->
          @if (activeTab() === 'grid') {
            <div class="space-y-6">
              <!-- Schema Analytics Dashboard (charts + active-filter HUD) -->
              <app-schema-analytics-dashboard></app-schema-analytics-dashboard>

              <!-- Results Grid -->
              <app-results-grid></app-results-grid>
            </div>
          }

          <!-- ── Balance Verification tab ────────────────────────────── -->
          @if (activeTab() === 'balance') {
            <app-balance-verification></app-balance-verification>
          }

        </div>
      }

      <!-- Code Generator Modal -->
      @if (state.showCodeGenerator() && state.config()) {
        <app-code-generator-modal></app-code-generator-modal>
      }

      <!-- Monte Carlo Validation Modal -->
      @if (state.showMonteCarloModal()) {
        <app-monte-carlo-modal></app-monte-carlo-modal>
      }
    </div>
  `
})
export class GeneratorComponent {
  public state = inject(RandomizationEngineFacade);
  private readonly document = inject(DOCUMENT);

  /** Active results tab – 'grid' (default) or 'balance'. */
  readonly activeTab = signal<ResultsTab>('grid');

  private static readonly SCROLL_DELAY_MS = 100;

  constructor() {
    effect(() => {
      if (this.state.results()) {
        setTimeout(() => {
          this.document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, GeneratorComponent.SCROLL_DELAY_MS);
      }
    });
  }
}
