import { TestBed } from '@angular/core/testing';
import { CodeGeneratorService } from './code-generator.service';
import { RandomizationConfig } from '../../../models/randomization.model';

describe('CodeGeneratorService', () => {
  let service: CodeGeneratorService;
  let mockConfig: RandomizationConfig;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CodeGeneratorService);

    mockConfig = {
      protocolId: 'TEST-123',
      studyName: 'Test Study',
      phase: 'Phase II',
      arms: [{ id: 'A', name: 'Active', ratio: 1 }],
      sites: ['Site1', 'Site2'],
      strata: [],
      blockSizes: [2, 4],
      stratumCaps: [],
      seed: 'test_seed',
      subjectIdMask: '[SiteID]-[001]'
    };
  });

  it('should generate valid R code', () => {
    const code = service.generateR(mockConfig);
    expect(code).toContain('Protocol: TEST-123');
    expect(code).toContain('sites <- c("Site1", "Site2")');
    expect(code).toContain('block_sizes <- c(2, 4)');
    expect(code).toContain('set.seed('); // verifies hash function fired
  });

  it('should generate valid Python code', () => {
    const code = service.generatePython(mockConfig);
    expect(code).toContain('import numpy as np');
    expect(code).toContain('sites = ["Site1", "Site2"]');
    expect(code).toContain('df = pd.DataFrame(schema)');
  });

  it('should generate valid SAS code', () => {
    const code = service.generateSas(mockConfig);
    expect(code).toContain('%let sites = "Site1" "Site2";');
    expect(code).toContain('proc sql noprint;');
    expect(code).toContain('proc freq data=final_schema;');
  });

  it('should handle empty config properties gracefully', () => {
    const emptyConfig = { ...mockConfig, protocolId: '', sites: [] };
    const code = service.generateR(emptyConfig);
    expect(code).toContain('Protocol: Unknown');
    expect(code).toContain('sites <- c()');
  });
});
