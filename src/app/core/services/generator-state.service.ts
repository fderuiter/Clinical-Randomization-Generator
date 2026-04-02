import { Injectable, signal, inject } from '@angular/core';
import { RandomizationConfig, RandomizationResult } from '../../models/randomization.model';
import { RandomizationService } from './randomization.service';

@Injectable({ providedIn: 'root' })
export class GeneratorStateService {
  private randomizationService = inject(RandomizationService);

  // Core State Signals
  readonly config = signal<RandomizationConfig | null>(null);
  readonly results = signal<RandomizationResult | null>(null);
  readonly isGenerating = signal(false);
  readonly error = signal<string | null>(null);

  // UI State Signals
  readonly showCodeGenerator = signal(false);
  readonly codeLanguage = signal<'R' | 'SAS' | 'Python'>('R');

  generateSchema(newConfig: RandomizationConfig) {
    this.config.set(newConfig);
    this.isGenerating.set(true);
    this.error.set(null);
    this.results.set(null);

    this.randomizationService.generateSchema(newConfig).subscribe({
      next: (res) => {
        this.results.set(res);
        this.isGenerating.set(false);
        // Keep the scroll behavior here for UX
        setTimeout(() => {
          document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      error: (err) => {
        console.error(err);
        this.error.set(err.error?.error || 'An error occurred during schema generation.');
        this.isGenerating.set(false);
      }
    });
  }

  openCodeGenerator(config: RandomizationConfig, language: 'R' | 'SAS' | 'Python') {
    this.config.set(config);
    this.codeLanguage.set(language);
    this.showCodeGenerator.set(true);
  }

  closeCodeGenerator() {
    this.showCodeGenerator.set(false);
  }
}
