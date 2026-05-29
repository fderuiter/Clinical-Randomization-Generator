import { RandomizationConfig } from '../../../core/models/randomization.model';

export interface CodeGenerationStrategy {
  readonly language: 'R' | 'SAS' | 'Python' | 'STATA';
  generate(config: RandomizationConfig): string;
  generateMinimization(config: RandomizationConfig): string;
}
