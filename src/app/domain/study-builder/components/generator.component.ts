import { ChangeDetectionStrategy, Component, inject, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ConfigFormComponent } from './config-form.component';
import { ResultsGridComponent } from '../../schema-management/components/results-grid.component';
import { CodeGeneratorModalComponent } from '../../schema-management/components/code-generator-modal.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-generator',
  imports: [ConfigFormComponent, ResultsGridComponent, CodeGeneratorModalComponent],
  template: `
    <div class="space-y-8">
      <!-- Intro -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-semibold text-gray-900">Study-Agnostic Randomization</h2>
        </div>
        <p class="text-gray-600 text-sm leading-relaxed">
          Configure your clinical trial parameters below to generate a statistically sound, reproducible, and balanced treatment allocation schema. 
          The system uses a seeded Fisher-Yates shuffle for stratified block randomization.
        </p>
      </div>

      <!-- Configuration Form -->
      <app-config-form></app-config-form>

      <!-- Loading State -->
      @if (state.isGenerating()) {
        <div class="flex flex-col items-center justify-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <svg class="animate-spin h-10 w-10 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-600 font-medium">Generating schema...</p>
        </div>
      }

      <!-- Error State -->
      @if (state.error()) {
        <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-700 font-medium">{{ state.error() }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Results Grid -->
      @if (state.results() && !state.isGenerating()) {
        <div id="results-section">
          <app-results-grid></app-results-grid>
        </div>
      }

      <!-- Code Generator Modal -->
      @if (state.showCodeGenerator() && state.config()) {
        <app-code-generator-modal></app-code-generator-modal>
      }
    </div>
  `
})
export class GeneratorComponent {
  public state = inject(RandomizationEngineFacade);
  private readonly document = inject(DOCUMENT);

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
