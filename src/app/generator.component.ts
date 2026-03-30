import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {ConfigFormComponent} from './config-form.component';
import {ResultsGridComponent} from './results-grid.component';
import {RandomizationService, RandomizationConfig, RandomizationResult} from './randomization.service';
import {CodeGeneratorModalComponent} from './code-generator-modal.component';

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
      <app-config-form (generate)="onGenerate($event)" (generateCode)="onGenerateCode($event)"></app-config-form>

      <!-- Loading State -->
      @if (isLoading()) {
        <div class="flex flex-col items-center justify-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <svg class="animate-spin h-10 w-10 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-600 font-medium">Generating schema...</p>
        </div>
      }

      <!-- Error State -->
      @if (error()) {
        <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-700 font-medium">{{ error() }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Results Grid -->
      @if (result() && !isLoading()) {
        <div id="results-section">
          <app-results-grid [data]="result()"></app-results-grid>
        </div>
      }

      <!-- Code Generator Modal -->
      @if (showCodeGenerator() && codeConfig()) {
        <app-code-generator-modal [config]="codeConfig()!" [initialTab]="codeLanguage()" (closeModal)="showCodeGenerator.set(false)"></app-code-generator-modal>
      }
    </div>
  `
})
export class GeneratorComponent {
  private randomizationService = inject(RandomizationService);
  
  isLoading = signal(false);
  error = signal<string | null>(null);
  result = signal<RandomizationResult | null>(null);
  showCodeGenerator = signal(false);
  codeConfig = signal<RandomizationConfig | null>(null);
  codeLanguage = signal<'R' | 'SAS' | 'Python'>('R');

  onGenerateCode(event: {config: RandomizationConfig, language: 'R' | 'SAS' | 'Python'}) {
    this.codeConfig.set(event.config);
    this.codeLanguage.set(event.language);
    this.showCodeGenerator.set(true);
  }

  onGenerate(config: RandomizationConfig) {
    this.isLoading.set(true);
    this.error.set(null);
    this.result.set(null);

    this.randomizationService.generateSchema(config).subscribe({
      next: (res) => {
        this.result.set(res);
        this.isLoading.set(false);
        setTimeout(() => {
          document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      error: (err) => {
        console.error(err);
        this.error.set(err.error?.error || 'An error occurred during schema generation.');
        this.isLoading.set(false);
      }
    });
  }
}
