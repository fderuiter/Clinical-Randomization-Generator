import { TestBed } from '@angular/core/testing';
import { CodeGeneratorModalComponent } from './code-generator-modal.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { CodeGeneratorService } from '../services/code-generator.service';
import { CodeGenerationError } from '../errors/code-generation-errors';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { RandomizationConfig } from '../../core/models/randomization.model';

describe('CodeGeneratorModalComponent (domain)', () => {
  let component: CodeGeneratorModalComponent;
  let mockFacade: any;
  let mockCodeGeneratorService: any;

  beforeEach(() => {
    mockFacade = {
      config: signal<RandomizationConfig | null>(null),
      results: signal(null),
      isGenerating: signal(false),
      error: signal(null),
      showCodeGenerator: signal(false),
      codeLanguage: signal('R'),
      generateSchema: vi.fn(),
      openCodeGenerator: vi.fn(),
      closeCodeGenerator: vi.fn(),
      clearResults: vi.fn()
    };

    mockCodeGeneratorService = {
      generate: vi.fn().mockReturnValue('Mock Generated Code'),
      generateR: vi.fn().mockReturnValue('Mock R Code'),
      generatePython: vi.fn().mockReturnValue('Mock Python Code'),
      generateSas: vi.fn().mockReturnValue('Mock SAS Code')
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: RandomizationEngineFacade, useValue: mockFacade },
        { provide: CodeGeneratorService, useValue: mockCodeGeneratorService }
      ]
    });

    TestBed.runInInjectionContext(() => {
      component = new CodeGeneratorModalComponent();
      component.ngOnInit();
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
      mockFacade.config.set(mockConfig);
    });

    it('should generate valid R code', () => {
      mockCodeGeneratorService.generate.mockReturnValue('Mock R Code');
      component.setActiveTab('R');
      const code = component.currentCode;
      expect(mockCodeGeneratorService.generate).toHaveBeenCalledWith('R', mockConfig);
      expect(code).toBe('Mock R Code');
    });

    it('should generate valid Python code', () => {
      mockCodeGeneratorService.generate.mockReturnValue('Mock Python Code');
      component.setActiveTab('Python');
      const code = component.currentCode;
      expect(mockCodeGeneratorService.generate).toHaveBeenCalledWith('Python', mockConfig);
      expect(code).toBe('Mock Python Code');
    });

    it('should generate valid SAS code', () => {
      mockCodeGeneratorService.generate.mockReturnValue('Mock SAS Code');
      component.setActiveTab('SAS');
      const code = component.currentCode;
      expect(mockCodeGeneratorService.generate).toHaveBeenCalledWith('SAS', mockConfig);
      expect(code).toBe('Mock SAS Code');
    });
  });

  describe('when config properties are undefined', () => {
    beforeEach(() => {
      mockFacade.config.set(null);
    });

    it('should handle missing config gracefully', () => {
      component.setActiveTab('R');
      const code = component.currentCode;
      expect(code).toBe('');
      expect(mockCodeGeneratorService.generate).not.toHaveBeenCalled();
    });
  });

  describe('downloadCode()', () => {
    let mockConfig: RandomizationConfig;

    beforeEach(() => {
      vi.useFakeTimers();
      globalThis.URL.createObjectURL = vi.fn(() => 'mock://url') as any;
      globalThis.URL.revokeObjectURL = vi.fn() as any;

      mockConfig = {
        protocolId: 'DL-TEST',
        studyName: 'Download Test',
        phase: 'Phase I',
        arms: [{ id: '1', name: 'Active', ratio: 1 }],
        sites: ['Site1'],
        strata: [],
        blockSizes: [2],
        stratumCaps: [],
        seed: 'dl_seed',
        subjectIdMask: '[SiteID]-[001]'
      };
      mockFacade.config.set(mockConfig);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const verifyDownloadFilename = (language: 'R' | 'SAS' | 'Python' | 'STATA', expectedFilename: string) => {
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
      vi.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);

      component.setActiveTab(language);
      component.downloadCode();

      const anchorEl = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchorEl.getAttribute('download')).toBe(expectedFilename);
    };

    it('should use randomization_schema.R as the filename for R code', () => {
      verifyDownloadFilename('R', 'randomization_schema.R');
    });

    it('should use randomization_schema.sas as the filename for SAS code', () => {
      verifyDownloadFilename('SAS', 'randomization_schema.sas');
    });

    it('should use randomization_schema.py as the filename for Python code', () => {
      verifyDownloadFilename('Python', 'randomization_schema.py');
    });

    it('should use randomization_schema.do as the filename for STATA code', () => {
      verifyDownloadFilename('STATA', 'randomization_schema.do');
    });

    it('should call URL.createObjectURL with a Blob', () => {
      vi.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
      vi.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);

      component.setActiveTab('R');
      component.downloadCode();

      expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });
  });

  describe('copyCode()', () => {
    let mockConfig: RandomizationConfig;

    beforeEach(() => {
      mockConfig = {
        protocolId: 'COPY-TEST',
        studyName: 'Copy Test',
        phase: 'Phase I',
        arms: [{ id: '1', name: 'Active', ratio: 1 }],
        sites: ['Site1'],
        strata: [],
        blockSizes: [2],
        stratumCaps: [],
        seed: 'copy_seed',
        subjectIdMask: '[SiteID]-[001]'
      };
      mockFacade.config.set(mockConfig);
      mockCodeGeneratorService.generate.mockReturnValue('Mock R Code');
      component.setActiveTab('R');
    });

    it('should write the current code to the clipboard', () => {
      const clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: clipboardWriteSpy },
        configurable: true,
        writable: true
      });

      component.copyCode();
      expect(clipboardWriteSpy).toHaveBeenCalledWith('Mock R Code');
    });

    it('should set the copied signal to true immediately after calling copyCode()', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
        writable: true
      });

      component.copyCode();
      expect(component.copied()).toBe(true);
    });
  });

  describe('error handling', () => {
    let mockConfig: RandomizationConfig;

    beforeEach(() => {
      mockConfig = {
        protocolId: 'ERR-TEST',
        studyName: 'Error Test',
        phase: 'Phase I',
        arms: [{ id: '1', name: 'Active', ratio: 1 }],
        sites: ['Site1'],
        strata: [],
        blockSizes: [2],
        stratumCaps: [],
        seed: 'err_seed',
        subjectIdMask: '[SiteID]-[001]'
      };
      mockFacade.config.set(mockConfig);
    });

    it('should set errorState when the code generator throws a CodeGenerationError', () => {
      const codeGenErr = new CodeGenerationError('Specific failure', mockConfig);
      mockCodeGeneratorService.generate.mockImplementation(() => { throw codeGenErr; });

      component.setActiveTab('R');

      expect(component.errorState()).toBe(codeGenErr);
      expect(component.currentCode).toBe('');
    });

    it('should wrap non-CodeGenerationError exceptions in a CodeGenerationError', () => {
      mockCodeGeneratorService.generate.mockImplementation(() => {
        throw new Error('raw failure');
      });

      component.setActiveTab('R');

      const err = component.errorState();
      expect(err).toBeInstanceOf(CodeGenerationError);
      expect(err!.message).toContain('raw failure');
    });

    it('should clear errorState and show code when switching to a tab that succeeds', () => {
      mockCodeGeneratorService.generate.mockImplementationOnce(() => { throw new CodeGenerationError('bad', mockConfig); });
      component.setActiveTab('R');
      expect(component.errorState()).not.toBeNull();

      mockCodeGeneratorService.generate.mockReturnValue('Good SAS code');
      component.setActiveTab('SAS');
      expect(component.errorState()).toBeNull();
      expect(component.currentCode).toBe('Good SAS code');
    });
  });
});
