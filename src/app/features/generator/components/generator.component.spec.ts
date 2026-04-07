import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeneratorComponent } from './generator.component';
import { RandomizationConfig, RandomizationResult } from '../../../models/randomization.model';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ConfigFormComponent } from './config-form.component';
import { ResultsGridComponent } from './results-grid.component';
import { CodeGeneratorModalComponent } from './code-generator-modal.component';
import { GeneratorStateService } from '../../../core/services/generator-state.service';


describe('GeneratorComponent', () => {
  let component: GeneratorComponent;
  let fixture: ComponentFixture<GeneratorComponent>;
  let mockStateService: any;

  const mockConfig: RandomizationConfig = {
    protocolId: 'TEST-123',
    studyName: 'Test Study',
    phase: 'Phase 1',
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
      phase: 'Phase 1',
      seed: 'test_seed',
      generatedAt: '2023-01-01',
      strata: [],
      config: mockConfig
    },
    schema: []
  };

  beforeEach(async () => {
    // Restore spy
    vi.restoreAllMocks();

    mockStateService = {
      config: signal(null),
      results: signal(null),
      isGenerating: signal(false),
      error: signal(null),
      showCodeGenerator: signal(false),
      codeLanguage: signal('R'),
      generateSchema: vi.fn(),
      openCodeGenerator: vi.fn(),
      closeCodeGenerator: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [GeneratorComponent], // Real component
      providers: [
        { provide: GeneratorStateService, useValue: mockStateService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render loading state correctly', () => {
    mockStateService.isGenerating.set(true);
    fixture.detectChanges();

    // Verify the loading spinner is rendered
    const loadingSpinner = fixture.debugElement.query(By.css('.animate-spin'));
    expect(loadingSpinner).toBeTruthy();
  });

  it('should render error state correctly', () => {
    mockStateService.error.set('Block size 4 is not a multiple of total ratio 3');
    fixture.detectChanges();

    // Verify the error banner is rendered in the DOM
    const errorBanner = fixture.debugElement.query(By.css('.bg-red-50'));
    expect(errorBanner).toBeTruthy();
    expect(errorBanner.nativeElement.textContent).toContain('Block size 4 is not a multiple of total ratio 3');

    // Verify the results grid is not rendered
    const resultsGrid = fixture.debugElement.query(By.css('app-results-grid'));
    expect(resultsGrid).toBeFalsy();
  });

  it('should render results grid correctly', () => {
    mockStateService.results.set(mockResult);
    mockStateService.isGenerating.set(false);
    fixture.detectChanges();

    // Verify the DOM renders the results grid
    const resultsGrid = fixture.debugElement.query(By.css('app-results-grid'));
    expect(resultsGrid).toBeTruthy();
  });

  it('should render code generator modal correctly', () => {
    mockStateService.showCodeGenerator.set(true);
    mockStateService.config.set(mockConfig);
    fixture.detectChanges();

    // Check that modal is shown in DOM
    const modal = fixture.debugElement.query(By.css('app-code-generator-modal'));
    expect(modal).toBeTruthy();
  });
});
