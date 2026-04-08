import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { GeneratorStateService } from './generator-state.service';
import { RandomizationService } from './randomization.service';
import { RandomizationConfig, RandomizationResult } from '../../models/randomization.model';

describe('GeneratorStateService', () => {
  let service: GeneratorStateService;
  let mockRandomizationService: { generateSchema: ReturnType<typeof vi.fn> };

  const mockConfig: RandomizationConfig = {
    protocolId: 'STATE-TEST-001',
    studyName: 'State Service Test Study',
    phase: 'Phase I',
    arms: [{ id: '1', name: 'Active', ratio: 1 }],
    sites: ['Site1'],
    strata: [],
    blockSizes: [2],
    stratumCaps: [{ levels: [], cap: 10 }],
    seed: 'test_seed',
    subjectIdMask: '[SiteID]-[001]'
  };

  const mockResult: RandomizationResult = {
    metadata: {
      protocolId: 'STATE-TEST-001',
      studyName: 'State Service Test Study',
      phase: 'Phase I',
      seed: 'test_seed',
      generatedAt: '2024-01-01T00:00:00.000Z',
      strata: [],
      config: mockConfig
    },
    schema: []
  };

  beforeEach(() => {
    mockRandomizationService = {
      generateSchema: vi.fn().mockReturnValue(of(mockResult))
    };

    TestBed.configureTestingModule({
      providers: [
        GeneratorStateService,
        { provide: RandomizationService, useValue: mockRandomizationService }
      ]
    });

    service = TestBed.inject(GeneratorStateService);
  });

  // ---------------------------------------------------------------------------
  // Initial signal state
  // ---------------------------------------------------------------------------
  describe('initial state', () => {
    it('should initialise config signal to null', () => {
      expect(service.config()).toBeNull();
    });

    it('should initialise results signal to null', () => {
      expect(service.results()).toBeNull();
    });

    it('should initialise isGenerating signal to false', () => {
      expect(service.isGenerating()).toBe(false);
    });

    it('should initialise error signal to null', () => {
      expect(service.error()).toBeNull();
    });

    it('should initialise showCodeGenerator signal to false', () => {
      expect(service.showCodeGenerator()).toBe(false);
    });

    it('should initialise codeLanguage signal to "R"', () => {
      expect(service.codeLanguage()).toBe('R');
    });
  });

  // ---------------------------------------------------------------------------
  // generateSchema()
  // ---------------------------------------------------------------------------
  describe('generateSchema()', () => {
    it('should update the config signal to the supplied config', () => {
      service.generateSchema(mockConfig);
      expect(service.config()).toEqual(mockConfig);
    });

    it('should call RandomizationService.generateSchema with the config', () => {
      service.generateSchema(mockConfig);
      expect(mockRandomizationService.generateSchema).toHaveBeenCalledWith(mockConfig);
    });

    it('should set results to the returned value on success', () => {
      service.generateSchema(mockConfig);
      expect(service.results()).toEqual(mockResult);
    });

    it('should set isGenerating to false after a successful synchronous call', () => {
      service.generateSchema(mockConfig);
      expect(service.isGenerating()).toBe(false);
    });

    it('should clear any previous error before generating', () => {
      service.error.set('previous error');
      service.generateSchema(mockConfig);
      expect(service.error()).toBeNull();
    });

    it('should set error and clear isGenerating on failure', () => {
      const errMsg = 'Block size 4 is not a multiple of total ratio 3';
      mockRandomizationService.generateSchema.mockReturnValue(
        throwError(() => ({ error: { error: errMsg } }))
      );
      service.generateSchema(mockConfig);

      expect(service.error()).toBe(errMsg);
      expect(service.isGenerating()).toBe(false);
    });

    it('should fall back to a generic message when the error payload is missing', () => {
      mockRandomizationService.generateSchema.mockReturnValue(
        throwError(() => ({}))
      );
      service.generateSchema(mockConfig);
      expect(service.error()).toBe('An error occurred during schema generation.');
    });

    it('should leave results null after a failed call', () => {
      mockRandomizationService.generateSchema.mockReturnValue(
        throwError(() => ({ error: { error: 'fail' } }))
      );
      service.generateSchema(mockConfig);
      expect(service.results()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // openCodeGenerator()
  // ---------------------------------------------------------------------------
  describe('openCodeGenerator()', () => {
    it('should set the config signal to the provided config', () => {
      service.openCodeGenerator(mockConfig, 'R');
      expect(service.config()).toEqual(mockConfig);
    });

    it('should set the codeLanguage signal to R', () => {
      service.openCodeGenerator(mockConfig, 'R');
      expect(service.codeLanguage()).toBe('R');
    });

    it('should set the codeLanguage signal to Python', () => {
      service.openCodeGenerator(mockConfig, 'Python');
      expect(service.codeLanguage()).toBe('Python');
    });

    it('should set the codeLanguage signal to SAS', () => {
      service.openCodeGenerator(mockConfig, 'SAS');
      expect(service.codeLanguage()).toBe('SAS');
    });

    it('should set showCodeGenerator to true', () => {
      expect(service.showCodeGenerator()).toBe(false);
      service.openCodeGenerator(mockConfig, 'R');
      expect(service.showCodeGenerator()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // closeCodeGenerator()
  // ---------------------------------------------------------------------------
  describe('closeCodeGenerator()', () => {
    it('should set showCodeGenerator to false', () => {
      service.showCodeGenerator.set(true);
      service.closeCodeGenerator();
      expect(service.showCodeGenerator()).toBe(false);
    });

    it('should not affect the config or codeLanguage signals', () => {
      service.config.set(mockConfig);
      service.codeLanguage.set('SAS');
      service.showCodeGenerator.set(true);
      service.closeCodeGenerator();

      expect(service.config()).toEqual(mockConfig);
      expect(service.codeLanguage()).toBe('SAS');
    });
  });

  // ---------------------------------------------------------------------------
  // clearResults()
  // ---------------------------------------------------------------------------
  describe('clearResults()', () => {
    it('should set results to null', () => {
      service.results.set(mockResult);
      service.clearResults();
      expect(service.results()).toBeNull();
    });

    it('should set error to null', () => {
      service.error.set('some error');
      service.clearResults();
      expect(service.error()).toBeNull();
    });

    it('should not affect config, isGenerating, or showCodeGenerator', () => {
      service.config.set(mockConfig);
      service.isGenerating.set(true);
      service.showCodeGenerator.set(true);
      service.results.set(mockResult);

      service.clearResults();

      expect(service.config()).toEqual(mockConfig);
      expect(service.isGenerating()).toBe(true);
      expect(service.showCodeGenerator()).toBe(true);
    });
  });
});
