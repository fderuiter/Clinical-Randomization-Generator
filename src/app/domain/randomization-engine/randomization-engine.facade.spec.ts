import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RandomizationEngineFacade } from './randomization-engine.facade';
import { RandomizationService } from './randomization.service';
import { RandomizationConfig, RandomizationResult } from '../core/models/randomization.model';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

describe('RandomizationEngineFacade', () => {
  let facade: RandomizationEngineFacade;
  let mockRandomizationService: { generateSchema: ReturnType<typeof vi.fn> };

  const mockConfig: RandomizationConfig = {
    protocolId: 'TEST-123',
    studyName: 'Test Study',
    phase: 'Phase I',
    arms: [{ id: '1', name: 'Arm A', ratio: 1 }],
    sites: ['Site1'],
    strata: [],
    blockSizes: [2],
    stratumCaps: [],
    seed: 'test_seed',
    subjectIdMask: '[SiteID]-[001]'
  };

  const mockResult: RandomizationResult = {
    metadata: {
      protocolId: 'TEST-123',
      studyName: 'Test Study',
      phase: 'Phase I',
      seed: 'test_seed',
      generatedAt: '2023-01-01',
      strata: [],
      config: mockConfig
    },
    schema: []
  };

  beforeEach(() => {
    mockRandomizationService = { generateSchema: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        // Force SSR platform to bypass Worker creation so tests run synchronously
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: RandomizationService, useValue: mockRandomizationService }
      ]
    });

    facade = TestBed.inject(RandomizationEngineFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialise with null results and no error', () => {
    expect(facade.results()).toBeNull();
    expect(facade.error()).toBeNull();
    expect(facade.isGenerating()).toBe(false);
  });

  it('should set isGenerating true then false after successful generation', () => {
    mockRandomizationService.generateSchema.mockReturnValue(of(mockResult));
    facade.generateSchema(mockConfig);
    // Synchronous observable resolves immediately
    expect(facade.isGenerating()).toBe(false);
    expect(facade.results()).toEqual(mockResult);
  });

  it('should set error signal on generation failure', () => {
    mockRandomizationService.generateSchema.mockReturnValue(
      throwError(() => ({ error: { error: 'Block size error' } }))
    );
    facade.generateSchema(mockConfig);
    expect(facade.error()).toBe('Block size error');
    expect(facade.isGenerating()).toBe(false);
  });

  it('should set config signal on generateSchema', () => {
    mockRandomizationService.generateSchema.mockReturnValue(of(mockResult));
    facade.generateSchema(mockConfig);
    expect(facade.config()).toEqual(mockConfig);
  });

  it('should clear results and error on clearResults()', () => {
    mockRandomizationService.generateSchema.mockReturnValue(of(mockResult));
    facade.generateSchema(mockConfig);
    expect(facade.results()).toBeTruthy();

    facade.clearResults();
    expect(facade.results()).toBeNull();
    expect(facade.error()).toBeNull();
  });

  it('should open code generator with correct language', () => {
    facade.openCodeGenerator(mockConfig, 'R');
    expect(facade.showCodeGenerator()).toBe(true);
    expect(facade.codeLanguage()).toBe('R');
    expect(facade.config()).toEqual(mockConfig);
  });

  it('should close code generator', () => {
    facade.openCodeGenerator(mockConfig, 'SAS');
    facade.closeCodeGenerator();
    expect(facade.showCodeGenerator()).toBe(false);
  });
});
