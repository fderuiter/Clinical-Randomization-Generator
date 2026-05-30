import { Injectable, inject, InjectionToken } from '@angular/core';
import { RandomizationConfig } from '../../core/models/randomization.model';
import {
  ConfigurationValidationError,
  UnsupportedLanguageError,
} from '../errors/code-generation-errors';
import { CodeGenerationStrategy } from './generation/base.strategy';
import { StaticMappingGuard } from './generation/static-mapping.guard';

import { RStrategy } from './generation/r.strategy';
import { PythonStrategy } from './generation/python.strategy';
import { SasStrategy } from './generation/sas.strategy';
import { StataStrategy } from './generation/stata.strategy';
import { MethodologySpecificationService } from './methodology-specification.service';

import { TrialRecord } from '../adapters/trial-record.model';

export const CODE_GENERATION_STRATEGIES = new InjectionToken<CodeGenerationStrategy[]>('CODE_GENERATION_STRATEGIES', {
  providedIn: 'root',
  factory: () => {
    const methodologySpec = inject(MethodologySpecificationService);
    return [
      new RStrategy(methodologySpec),
      new PythonStrategy(methodologySpec),
      new SasStrategy(methodologySpec),
      new StataStrategy(methodologySpec)
    ];
  }
});

@Injectable({ providedIn: 'root' })
export class CodeGeneratorService {
  private strategies = inject(CODE_GENERATION_STRATEGIES, { optional: true }) || [];

  /**
   * Phase 0 – Language dispatch entry point.
   * Runs pre-flight config validation, then delegates to the appropriate generator.
   */
  generate(language: 'R' | 'SAS' | 'Python' | 'STATA', config: RandomizationConfig, records?: TrialRecord[]): string {
    this.validateConfig(config);
    
    const strategy = this.strategies.find(s => s.language === language);
    if (!strategy) {
      throw new UnsupportedLanguageError(language as string, config);
    }

    let output: string;
    if (config.randomizationMethod === 'MINIMIZATION') {
      output = strategy.generateMinimization(config, records);
    } else {
      output = strategy.generate(config, records);
    }

    // Static mapping guard runs after generation
    StaticMappingGuard.verify(language, config, output);
    return output;
  }

  /**
   * Phase 1 – Pre-flight validation.
   */
  private validateConfig(config: RandomizationConfig): void {
    if (!config.arms || config.arms.length === 0) {
      throw new ConfigurationValidationError('Arms array is empty. At least one treatment arm is required.', config);
    }

    if (config.randomizationMethod === 'MINIMIZATION') {
      const n = config.minimizationConfig?.totalSampleSize;
      if (!Number.isFinite(n) || (n as number) <= 0) {
        throw new ConfigurationValidationError(
          'Total sample size must be a positive number for minimization.',
          config
        );
      }
      const pVal = config.minimizationConfig?.p;
      if (!Number.isFinite(pVal) || (pVal as number) < 0.5 || (pVal as number) > 1.0) {
        throw new ConfigurationValidationError(
          'Minimization probability `p` must be a number between 0.5 and 1.0.',
          config
        );
      }
      return;
    }

    // Block sizes are not used by minimization
    const effectiveSizes = config.globalBlockStrategy?.sizes ?? config.blockSizes;
    if (!effectiveSizes || effectiveSizes.length === 0) {
      throw new ConfigurationValidationError('Block sizes array is empty. At least one block size is required.', config);
    }
  }

  generateR(config: RandomizationConfig, records?: TrialRecord[]): string {
    return this.generate('R', config, records);
  }

  generatePython(config: RandomizationConfig, records?: TrialRecord[]): string {
    return this.generate('Python', config, records);
  }

  generateSas(config: RandomizationConfig, records?: TrialRecord[]): string {
    return this.generate('SAS', config, records);
  }

  generateStata(config: RandomizationConfig, records?: TrialRecord[]): string {
    return this.generate('STATA', config, records);
  }
}
