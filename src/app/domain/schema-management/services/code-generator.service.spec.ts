import { TestBed } from '@angular/core/testing';
import { CodeGeneratorService } from './code-generator.service';
import { RStrategy } from './generation/r.strategy';
import { PythonStrategy } from './generation/python.strategy';
import { SasStrategy } from './generation/sas.strategy';
import { StataStrategy } from './generation/stata.strategy';
import { CodeGenerationStrategy } from './generation/base.strategy';
import { MethodologySpecificationService } from './methodology-specification.service';

describe('CodeGeneratorService', () => {
  let service: CodeGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CodeGeneratorService,
        MethodologySpecificationService,
        {
          provide: 'CODE_GENERATION_STRATEGIES',
          useFactory: (r: RStrategy, p: PythonStrategy, s: SasStrategy, st: StataStrategy) => [r, p, s, st],
          deps: [RStrategy, PythonStrategy, SasStrategy, StataStrategy]
        },
        RStrategy,
        PythonStrategy,
        SasStrategy,
        StataStrategy
      ]
    });
    service = TestBed.inject(CodeGeneratorService);
  });

  it('should generate code for all languages', () => {
    const config = {
      protocolId: 'test',
      studyName: 'test',
      phase: 'Phase I',
      arms: [{ id: 'A', name: 'A', ratio: 1 }],
      sites: ['Site1'],
      seed: 'seed',
      blockSizes: [2],
      strata: [],
      stratumCaps: []
    } as any;
    
    expect(service.generate('R', config)).toContain('Randomization Schema');
    expect(service.generate('Python', config)).toContain('Randomization Schema');
    expect(service.generate('SAS', config)).toContain('Randomization Schema');
    expect(service.generate('STATA', config)).toContain('Randomization Schema');
  });
});
