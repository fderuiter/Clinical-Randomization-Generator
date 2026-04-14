import { TestBed } from '@angular/core/testing';
import { GeneratorComponent } from './generator.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { RandomizationResult } from '../../core/models/randomization.model';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildMockFacade() {
  return {
    config: signal(null),
    results: signal<RandomizationResult | null>(null),
    isGenerating: signal(false),
    error: signal<string | null>(null),
    showCodeGenerator: signal(false),
    codeLanguage: signal<'R' | 'SAS' | 'Python' | 'STATA'>('R'),
    // Monte Carlo state
    showMonteCarloModal: signal(false),
    isMonteCarloRunning: signal(false),
    monteCarloProgress: signal(0),
    monteCarloResults: signal(null),
    generateSchema: vi.fn(),
    openCodeGenerator: vi.fn(),
    closeCodeGenerator: vi.fn(),
    clearResults: vi.fn(),
    runMonteCarlo: vi.fn(),
    closeMonteCarloModal: vi.fn()
  };
}

const MOCK_RESULT: RandomizationResult = {
  metadata: {
    protocolId: 'GEN-001',
    studyName: 'Generator Test',
    phase: 'Phase II',
    seed: 'gen_seed',
    generatedAt: '2024-01-01T00:00:00.000Z',
    strata: [],
    auditHash: 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233',
    config: {} as never
  },
  schema: []
};

// ─────────────────────────────────────────────────────────────────────────────
// Specs
// ─────────────────────────────────────────────────────────────────────────────

describe('GeneratorComponent (domain)', () => {
  let mockFacade: ReturnType<typeof buildMockFacade>;

  beforeEach(async () => {
    mockFacade = buildMockFacade();

    await TestBed.configureTestingModule({
      imports: [GeneratorComponent],
      providers: [
        { provide: RandomizationEngineFacade, useValue: mockFacade },
        provideRouter([])
      ]
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should inject the facade as `state`', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    expect(fixture.componentInstance.state).toBe(mockFacade as unknown as RandomizationEngineFacade);
  });

  // ── Loading state (Skeleton Grid replaces the legacy spinner) ─────────────

  it('should show skeleton grid when isGenerating is true', () => {
    mockFacade.isGenerating.set(true);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="skeleton-grid"]')).toBeTruthy();
  });

  it('should NOT show skeleton grid when isGenerating is false', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="skeleton-grid"]')).toBeFalsy();
  });

  it('should hide the skeleton once isGenerating transitions back to false', () => {
    mockFacade.isGenerating.set(true);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="skeleton-grid"]')).toBeTruthy();

    mockFacade.isGenerating.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="skeleton-grid"]')).toBeFalsy();
  });

  it('should NOT show the legacy spinner SVG at any point', () => {
    mockFacade.isGenerating.set(true);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    // The old animate-spin spinner has been removed; only skeleton is used.
    expect(fixture.nativeElement.querySelector('.animate-spin')).toBeFalsy();
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it('should NOT show an inline error banner when error signal has a value (errors use the Toast system)', () => {
    mockFacade.error.set('Block size error');
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    // The static error banner has been removed; errors are now surfaced via
    // the ToastService overlay, not as inline DOM elements.
    expect(fixture.nativeElement.querySelector('[data-testid="generator-inline-error"]')).toBeFalsy();
    expect(fixture.nativeElement.textContent).not.toContain('Block size error');
  });

  it('should NOT show error banner when error signal is null', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // No red error banner present
    expect(el.querySelector('[data-testid="generator-inline-error"]')).toBeFalsy();
  });

  it('should not render inline error text when the error signal changes reactively', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();

    mockFacade.error.set('New validation error');
    fixture.detectChanges();
    // Errors are handled by the Toast overlay, not the component template.
    expect(fixture.nativeElement.textContent).not.toContain('New validation error');
  });

  // ── Results section ────────────────────────────────────────────────────────

  it('should render the results section when results are available and not generating', () => {
    mockFacade.results.set(MOCK_RESULT);
    mockFacade.isGenerating.set(false);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#results-section')).toBeTruthy();
  });

  it('should NOT render the results section when results is null', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#results-section')).toBeFalsy();
  });

  it('should NOT render the results section while still generating (even if previous results exist)', () => {
    mockFacade.results.set(MOCK_RESULT);
    mockFacade.isGenerating.set(true);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#results-section')).toBeFalsy();
  });

  // ── Zero-State ─────────────────────────────────────────────────────────────

  it('should render the zero-state when there are no results and not generating', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="zero-state"]')).toBeTruthy();
  });

  it('should NOT render the zero-state when results are available', () => {
    mockFacade.results.set(MOCK_RESULT);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="zero-state"]')).toBeFalsy();
  });

  it('should NOT render the zero-state while generating', () => {
    mockFacade.isGenerating.set(true);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="zero-state"]')).toBeFalsy();
  });

  it('zero-state Load Preset button should call configForm.loadPreset("standard") when clicked', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();

    // Spy on the embedded ConfigFormComponent instance
    const configForm = fixture.componentInstance['configForm']();
    if (configForm) {
      const spy = vi.spyOn(configForm, 'loadPreset');
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="load-preset-btn"]');
      btn.click();
      fixture.detectChanges();
      expect(spy).toHaveBeenCalledWith('standard');
    }
  });

  // ── State machine mutual exclusivity ───────────────────────────────────────

  it('state machine: only skeleton visible while generating', () => {
    mockFacade.isGenerating.set(true);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="skeleton-grid"]')).toBeTruthy();
    expect(el.querySelector('#results-section')).toBeFalsy();
    expect(el.querySelector('[data-testid="zero-state"]')).toBeFalsy();
  });

  it('state machine: only results section visible when results exist and not generating', () => {
    mockFacade.results.set(MOCK_RESULT);
    mockFacade.isGenerating.set(false);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="skeleton-grid"]')).toBeFalsy();
    expect(el.querySelector('#results-section')).toBeTruthy();
    expect(el.querySelector('[data-testid="zero-state"]')).toBeFalsy();
  });

  it('state machine: only zero-state visible on initial load', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="skeleton-grid"]')).toBeFalsy();
    expect(el.querySelector('#results-section')).toBeFalsy();
    expect(el.querySelector('[data-testid="zero-state"]')).toBeTruthy();
  });

  // ── Code generator modal ───────────────────────────────────────────────────

  it('should render the code generator modal when showCodeGenerator is true and config is set', () => {
    mockFacade.showCodeGenerator.set(true);
    // config just needs to be truthy for the @if condition
    (mockFacade.config as ReturnType<typeof signal<unknown>>).set({
      protocolId: 'X', studyName: 'X', phase: 'I',
      arms: [], sites: [], strata: [], blockSizes: [], stratumCaps: [],
      seed: '', subjectIdMask: ''
    });
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-code-generator-modal')).toBeTruthy();
  });

  it('should NOT render the code generator modal when showCodeGenerator is false', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-code-generator-modal')).toBeFalsy();
  });

  // ── Intro section ─────────────────────────────────────────────────────────

  it('should always render the intro heading', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Study-Agnostic Randomization');
  });

  it('should always render the config form', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-config-form')).toBeTruthy();
  });
});
