import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeneratorComponent } from './generator.component';
import { RandomizationService, RandomizationConfig, RandomizationResult } from './randomization.service';
import { of, throwError, delay } from 'rxjs';
import { By } from '@angular/platform-browser';
import { Component, EventEmitter, Output } from '@angular/core';
import { vi } from 'vitest';
import { ConfigFormComponent } from './config-form.component';
import { ResultsGridComponent } from './results-grid.component';
import { CodeGeneratorModalComponent } from './code-generator-modal.component';


describe('GeneratorComponent', () => {
  let component: GeneratorComponent;
  let fixture: ComponentFixture<GeneratorComponent>;
  let randomizationService: any;

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

    // Vitest spy object
    const spy = {
      generateSchema: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [GeneratorComponent], // Real component
      providers: [
        { provide: RandomizationService, useValue: spy }
      ]
    }).compileComponents();

    randomizationService = TestBed.inject(RandomizationService) as any;
    fixture = TestBed.createComponent(GeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should handle success state correctly', async () => {
    // Mock getElementById to avoid scrollIntoView error in jsdom
    const mockElement = { scrollIntoView: vi.fn(), setAttribute: vi.fn() };
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as any);

    // Use delay to allow asserting intermediate loading state
    randomizationService.generateSchema.mockReturnValue(of(mockResult).pipe(delay(50)));

    // Trigger generate
    component.onGenerate(mockConfig);
    fixture.detectChanges();

    // Check loading state immediately after triggering
    expect(component.isLoading()).toBe(true);

    // Give it time to resolve observable and the 100ms timeout
    await new Promise(resolve => setTimeout(resolve, 200));
    fixture.detectChanges();

    // Verify success state changes
    expect(component.isLoading()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.result()).toEqual(mockResult);

    // Verify the DOM renders the results grid
    const resultsGrid = fixture.debugElement.query(By.css('app-results-grid'));
    expect(resultsGrid).toBeTruthy();

    // Verify the loading spinner is gone
    const loadingSpinner = fixture.debugElement.query(By.css('.animate-spin'));
    expect(loadingSpinner).toBeFalsy();
  });

  it('should handle error state correctly', () => {
    const mockError = { error: { error: 'Block size 4 is not a multiple of total ratio 3' } };
    randomizationService.generateSchema.mockReturnValue(throwError(() => mockError));

    // Trigger generate
    component.onGenerate(mockConfig);
    fixture.detectChanges();

    // Verify error state changes
    expect(component.isLoading()).toBe(false);
    expect(component.result()).toBeNull();
    expect(component.error()).toBe('Block size 4 is not a multiple of total ratio 3');

    // Verify the error banner is rendered in the DOM
    const errorBanner = fixture.debugElement.query(By.css('.bg-red-50'));
    expect(errorBanner).toBeTruthy();
    expect(errorBanner.nativeElement.textContent).toContain('Block size 4 is not a multiple of total ratio 3');

    // Verify the results grid is not rendered
    const resultsGrid = fixture.debugElement.query(By.css('app-results-grid'));
    expect(resultsGrid).toBeFalsy();
  });

  it('should handle child component generate event', () => {
    // Need to supply mockReturnValue so it doesn't try to subscribe to undefined
    randomizationService.generateSchema.mockReturnValue(of(mockResult));
    vi.spyOn(component, 'onGenerate');
    const configForm = fixture.debugElement.query(By.css('app-config-form'));

    // Emit the event from the child component
    configForm.componentInstance.generate.emit(mockConfig);

    expect(component.onGenerate).toHaveBeenCalledWith(mockConfig);
  });

  it('should handle child component generateCode event', () => {
    vi.spyOn(component, 'onGenerateCode');
    const configForm = fixture.debugElement.query(By.css('app-config-form'));

    const eventData: {config: RandomizationConfig, language: 'R' | 'SAS' | 'Python'} = { config: mockConfig, language: 'Python' };

    // Emit the event from the child component
    configForm.componentInstance.generateCode.emit(eventData);

    expect(component.onGenerateCode).toHaveBeenCalledWith(eventData);

    fixture.detectChanges();

    // Check signals are updated
    expect(component.codeConfig()).toEqual(mockConfig);
    expect(component.codeLanguage()).toBe('Python');
    expect(component.showCodeGenerator()).toBe(true);

    // Check that modal is shown in DOM
    const modal = fixture.debugElement.query(By.css('app-code-generator-modal'));
    expect(modal).toBeTruthy();
  });
});
