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
    codeLanguage: signal<'R' | 'SAS' | 'Python'>('R'),
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

  // ── Loading state ──────────────────────────────────────────────────────────

  it('should show loading spinner when isGenerating is true', () => {
    mockFacade.isGenerating.set(true);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.animate-spin')).toBeTruthy();
  });

  it('should NOT show loading spinner when isGenerating is false', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.animate-spin')).toBeFalsy();
  });

  it('should hide the spinner once isGenerating transitions back to false', () => {
    mockFacade.isGenerating.set(true);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.animate-spin')).toBeTruthy();

    mockFacade.isGenerating.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.animate-spin')).toBeFalsy();
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it('should NOT show an inline error banner when error signal has a value (errors use the Toast system)', () => {
    mockFacade.error.set('Block size error');
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    // The static error banner has been removed; errors are now surfaced via
    // the ToastService overlay, not as inline DOM elements.
    expect(fixture.nativeElement.querySelector('.bg-red-50')).toBeFalsy();
    expect(fixture.nativeElement.textContent).not.toContain('Block size error');
  });

  it('should NOT show error banner when error signal is null', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // No red error banner present
    expect(el.querySelector('.bg-red-50')).toBeFalsy();
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
