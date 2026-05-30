import { RandomizationConfig } from '../../../core/models/randomization.model';

export interface CodeGenerationStrategy {
  readonly language: 'R' | 'SAS' | 'Python' | 'STATA';
  generate(config: RandomizationConfig, records?: any[]): string;
  generateMinimization(config: RandomizationConfig, records?: any[]): string;
}
