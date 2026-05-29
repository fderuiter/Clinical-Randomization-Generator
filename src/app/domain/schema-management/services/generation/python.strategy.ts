import { Injectable } from '@angular/core';
import { RandomizationConfig } from '../../../core/models/randomization.model';
import { CodeGenerationStrategy } from './base.strategy';
import { CodeTranspiler } from './ir/transpiler';
import { MethodologySpecificationService } from '../methodology-specification.service';

@Injectable()
export class PythonStrategy implements CodeGenerationStrategy {
  readonly language = 'Python';

  constructor(private methodologySpec: MethodologySpecificationService) {}

  generate(config: RandomizationConfig): string {
    return CodeTranspiler.transpile(this.language, config, 'BLOCK');
  }

  generateMinimization(config: RandomizationConfig): string {
    return CodeTranspiler.transpile(this.language, config, 'MINIMIZATION');
  }
}
