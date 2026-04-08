import { TestBed } from '@angular/core/testing';
import { CodeGeneratorModalComponent } from './code-generator-modal.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { CodeGeneratorService } from '../services/code-generator.service';
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
      mockFacade.config.set(null);
    });

    it('should handle missing config gracefully', () => {
      component.activeTab.set('R');
      const code = component.currentCode;
      expect(code).toBe('');
      expect(mockCodeGeneratorService.generateR).not.toHaveBeenCalled();
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

    const verifyDownloadFilename = (language: 'R' | 'SAS' | 'Python', expectedFilename: string) => {
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
      vi.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);

      component.activeTab.set(language);
      component.downloadCode();

      const anchorEl = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchorEl.getAttribute('download')).toBe(expectedFilename);
    };

    it('should use randomization_code.R as the filename for R code', () => {
      verifyDownloadFilename('R', 'randomization_code.R');
    });

    it('should use randomization_code.sas as the filename for SAS code', () => {
      verifyDownloadFilename('SAS', 'randomization_code.sas');
    });

    it('should use randomization_code.py as the filename for Python code', () => {
      verifyDownloadFilename('Python', 'randomization_code.py');
    });

    it('should call URL.createObjectURL with a Blob', () => {
      vi.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
      vi.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);

      component.activeTab.set('R');
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
    });

    it('should write the current code to the clipboard', () => {
      const clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: clipboardWriteSpy },
        configurable: true,
        writable: true
      });

      component.activeTab.set('R');
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

  describe('error handling in currentCode', () => {
    it('should return the error string when the code generator throws', () => {
      const mockConfig: RandomizationConfig = {
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
      mockCodeGeneratorService.generateR.mockImplementation(() => {
        throw new Error('generation failed');
      });
      mockFacade.config.set(mockConfig);
      component.activeTab.set('R');

      const code = component.currentCode;
      expect(code).toBe('Error generating code. Please check your configuration.');
    });
  });
});
