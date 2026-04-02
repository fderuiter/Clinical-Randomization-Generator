import { TestBed } from '@angular/core/testing';
import { CodeGeneratorModalComponent } from './code-generator-modal.component';
import { GeneratorStateService } from '../../../core/services/generator-state.service';
import { CodeGeneratorService } from '../services/code-generator.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { RandomizationConfig } from '../../../models/randomization.model';

describe('CodeGeneratorModalComponent', () => {
  let component: CodeGeneratorModalComponent;
  let mockStateService: any;
  let mockCodeGeneratorService: any;

  beforeEach(() => {
    mockStateService = {
      config: signal<RandomizationConfig | null>(null),
      results: signal(null),
      isGenerating: signal(false),
      error: signal(null),
      showCodeGenerator: signal(false),
      codeLanguage: signal('R'),
      generateSchema: vi.fn(),
      openCodeGenerator: vi.fn(),
      closeCodeGenerator: vi.fn()
    };

    mockCodeGeneratorService = {
      generateR: vi.fn().mockReturnValue('Mock R Code'),
      generatePython: vi.fn().mockReturnValue('Mock Python Code'),
      generateSas: vi.fn().mockReturnValue('Mock SAS Code')
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: GeneratorStateService, useValue: mockStateService },
        { provide: CodeGeneratorService, useValue: mockCodeGeneratorService }
      ]
    });

    TestBed.runInInjectionContext(() => {
      component = new CodeGeneratorModalComponent();
    });
  });

  describe('when config is fully populated', () => {
    let mockConfig: RandomizationConfig;

    beforeEach(() => {
      mockConfig = {
        protocolId: 'TEST-123',
        studyName: 'Test Study',
        phase: 'Phase 1',
        arms: [
          { id: '1', name: 'Arm A', ratio: 1 },
          { id: '2', name: 'Arm B', ratio: 2 }
        ],
        sites: ['Site1', 'Site2'],
        strata: [
          { id: 'strata1', name: 'Strata 1', levels: ['Low', 'High'] },
          { id: 'strata2', name: 'Strata 2', levels: ['Yes', 'No'] }
        ],
        blockSizes: [3, 6],
        stratumCaps: [
          { levels: ['Low', 'Yes'], cap: 10 },
          { levels: ['Low', 'No'], cap: 15 },
          { levels: ['High', 'Yes'], cap: 5 },
          { levels: ['High', 'No'], cap: 20 }
        ],
        seed: 'test_seed',
        subjectIdMask: '[SiteID]-[StratumCode]-[001]'
      };
      mockStateService.config.set(mockConfig);
    });

    it('should generate valid R code', () => {
      component.activeTab.set('R');
      const code = component.currentCode;
      expect(mockCodeGeneratorService.generateR).toHaveBeenCalledWith(mockConfig);
      expect(code).toBe('Mock R Code');
    });

    it('should generate valid Python code', () => {
      component.activeTab.set('Python');
      const code = component.currentCode;
      expect(mockCodeGeneratorService.generatePython).toHaveBeenCalledWith(mockConfig);
      expect(code).toBe('Mock Python Code');
    });

    it('should generate valid SAS code', () => {
      component.activeTab.set('SAS');
      const code = component.currentCode;
      expect(mockCodeGeneratorService.generateSas).toHaveBeenCalledWith(mockConfig);
      expect(code).toBe('Mock SAS Code');
    });
  });

  describe('when config properties are undefined', () => {
    beforeEach(() => {
      mockStateService.config.set(null);
    });

    it('should handle missing config gracefully', () => {
      component.activeTab.set('R');
      const code = component.currentCode;
      expect(code).toBe('');
      expect(mockCodeGeneratorService.generateR).not.toHaveBeenCalled();
    });
  });
});