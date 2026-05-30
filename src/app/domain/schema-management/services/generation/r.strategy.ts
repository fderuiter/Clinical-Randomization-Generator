import { Injectable } from '@angular/core';
import { RandomizationConfig } from '../../../core/models/randomization.model';
import { CodeGenerationStrategy } from './base.strategy';
import { CodeTranspiler } from './ir/transpiler';
import { MethodologySpecificationService } from '../methodology-specification.service';

@Injectable()
export class RStrategy implements CodeGenerationStrategy {
  readonly language = 'R';

  constructor(private methodologySpec: MethodologySpecificationService) {}

  generate(config: RandomizationConfig, records?: any[]): string {
    return CodeTranspiler.transpile(this.language, config, 'BLOCK', records);
  }

  generateMinimization(config: RandomizationConfig, records?: any[]): string {
    return CodeTranspiler.transpile(this.language, config, 'MINIMIZATION', records);
  }
}
