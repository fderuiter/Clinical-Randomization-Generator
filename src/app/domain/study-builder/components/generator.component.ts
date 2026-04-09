import { ChangeDetectionStrategy, Component, inject, effect, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ConfigFormComponent } from './config-form.component';
import { ZeroStateComponent } from './zero-state.component';
import { SkeletonGridComponent } from './skeleton-grid.component';
import { ResultsGridComponent } from '../../schema-management/components/results-grid.component';
import { CodeGeneratorModalComponent } from '../../schema-management/components/code-generator-modal.component';
import { MonteCarloModalComponent } from '../../randomization-engine/components/monte-carlo-modal.component';
import { SchemaAnalyticsDashboardComponent } from '../../schema-management/components/schema-analytics-dashboard.component';
import { BalanceVerificationComponent } from '../../schema-management/components/balance-verification.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { ViewportService } from '../../../core/services/viewport.service';

type ResultsTab = 'grid' | 'balance';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-generator',
  imports: [
    ConfigFormComponent,
    ZeroStateComponent,
    SkeletonGridComponent,
    ResultsGridComponent,
    CodeGeneratorModalComponent,
    MonteCarloModalComponent,
    SchemaAnalyticsDashboardComponent,
    BalanceVerificationComponent,
  ],
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
      <app-config-form #configForm></app-config-form>

      <!-- ── Deterministic Results State Machine ───────────────────── -->
      <!--
        Exactly ONE of these three states is visible at any given time:
          1. isGenerating  → Skeleton Grid (pulsing placeholder)
          2. has results   → Populated Results section
          3. fallback      → Zero-State welcome screen
      -->

      @if (state.isGenerating()) {

        <!-- State 1: Generating – Skeleton Grid -->
        <div id="skeleton-section">
          <app-skeleton-grid></app-skeleton-grid>
        </div>

      } @else if (state.results()) {

        <!-- State 2: Results available -->
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
              <!-- Schema Analytics Dashboard (heavy ECharts):
                   Fully unmounted on mobile to save CPU/memory.
                   A lightweight text summary is rendered instead. -->
              @if (!viewport.isMobile()) {
                <app-schema-analytics-dashboard></app-schema-analytics-dashboard>
              } @else {
                <!-- Mobile: text-based analytics summary -->
                @if (state.results(); as data) {
                  <div data-testid="mobile-analytics-summary" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 space-y-2">
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-slate-100">Schema Summary</h3>
                    <ul class="text-sm text-gray-700 dark:text-slate-300 space-y-1">
                      <li><span class="font-medium">Protocol:</span> {{data.metadata.protocolId}}</li>
                      <li><span class="font-medium">Total subjects:</span> {{data.schema.length}}</li>
                      <li><span class="font-medium">Strata factors:</span> {{data.metadata.strata.length ?? 0}}</li>
                      <li><span class="font-medium">Seed:</span> <code class="font-mono text-xs bg-gray-100 dark:bg-slate-700 px-1 rounded">{{data.metadata.seed}}</code></li>
                    </ul>
                    <p class="text-xs text-gray-400 dark:text-slate-500">Switch to a larger screen to view interactive charts.</p>
                  </div>
                }
              }

              <!-- Results Grid -->
              <app-results-grid></app-results-grid>
            </div>
          }

          <!-- ── Balance Verification tab ────────────────────────────── -->
          @if (activeTab() === 'balance') {
            <app-balance-verification></app-balance-verification>
          }

        </div>

      } @else {

        <!-- State 3: Zero-State – initial load / no results yet -->
        <app-zero-state (loadPreset)="onLoadPreset()"></app-zero-state>

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
  public readonly viewport = inject(ViewportService);
  private readonly document = inject(DOCUMENT);

  /** Active results tab – 'grid' (default) or 'balance'. */
  readonly activeTab = signal<ResultsTab>('grid');

  /** Reference to the embedded config form so we can drive preset loading. */
  private readonly configForm = viewChild<ConfigFormComponent>('configForm');

  private static readonly SCROLL_DELAY_MS = 100;

  constructor() {
    // Scroll to the skeleton as soon as generation starts, giving the user
    // immediate tactile feedback that work has begun.
    effect(() => {
      if (this.state.isGenerating()) {
        setTimeout(() => {
          this.document.getElementById('skeleton-section')?.scrollIntoView({ behavior: 'smooth' });
        }, GeneratorComponent.SCROLL_DELAY_MS);
      }
    });

    // Scroll to results once generation is complete.
    effect(() => {
      if (this.state.results() && !this.state.isGenerating()) {
        setTimeout(() => {
          this.document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, GeneratorComponent.SCROLL_DELAY_MS);
      }
    });
  }

  /**
   * The preset type loaded when the user clicks the Zero-State CTA.
   * Using a named constant guards against typos and makes the intent clear.
   */
  private static readonly ONBOARDING_PRESET = 'standard' as const;

  /**
   * Called when the Zero-State CTA is clicked.
   * Hydrates the config form with the standard Phase II trial preset so new
   * users can explore the application without manual data entry.
   */
  onLoadPreset(): void {
    this.configForm()?.loadPreset(GeneratorComponent.ONBOARDING_PRESET);
  }
}
