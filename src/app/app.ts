import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {ConfigFormComponent} from './config-form.component';
import {ResultsGridComponent} from './results-grid.component';
import {AuditLogModalComponent} from './audit-log-modal.component';
import {RandomizationService, RandomizationConfig, RandomizationResult} from './randomization.service';
import {CodeGeneratorModalComponent} from './code-generator-modal.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [ConfigFormComponent, ResultsGridComponent, AuditLogModalComponent, CodeGeneratorModalComponent],
  template: `
    <div class="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header class="bg-indigo-700 text-white shadow-md">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <h1 class="text-2xl font-bold tracking-tight">Clinical Randomization Generator</h1>
          </div>
          <div class="flex items-center gap-4 text-indigo-200 text-sm font-medium">
            <button (click)="showAuditLog.set(true)" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md transition-colors border border-indigo-400 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Audit Log
            </button>
            <span>21 CFR Part 11 Ready</span>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <!-- Intro -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-2">Study-Agnostic Randomization</h2>
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
      </main>

      <!-- Audit Log Modal -->
      @if (showAuditLog()) {
        <app-audit-log-modal (close)="showAuditLog.set(false)"></app-audit-log-modal>
      }

      <!-- Code Generator Modal -->
      @if (showCodeGenerator() && codeConfig()) {
        <app-code-generator-modal [config]="codeConfig()!" [initialTab]="codeLanguage()" (close)="showCodeGenerator.set(false)"></app-code-generator-modal>
      }
    </div>
  `
})
export class App {
  private randomizationService = inject(RandomizationService);
  
  isLoading = signal(false);
  error = signal<string | null>(null);
  result = signal<RandomizationResult | null>(null);
  showAuditLog = signal(false);
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
