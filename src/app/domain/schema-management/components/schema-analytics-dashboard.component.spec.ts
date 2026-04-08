import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchemaAnalyticsDashboardComponent } from './schema-analytics-dashboard.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { SchemaViewStateService } from '../services/schema-view-state.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { RandomizationResult } from '../../core/models/randomization.model';

function buildMockResult(count: number): RandomizationResult {
  return {
    metadata: {
      protocolId: 'DASH-001',
      studyName: 'Dashboard Test',
      phase: 'Phase II',
      seed: '99',
      generatedAt: '2024-01-01T00:00:00.000Z',
      strata: [],
      config: {} as never
    },
    schema: Array.from({ length: count }, (_, i) => ({
      subjectId: `S-${i + 1}`,
      site: i % 3 === 0 ? 'Site 101' : (i % 3 === 1 ? 'Site 102' : 'Site 103'),
      stratum: {},
      stratumCode: '',
      blockNumber: Math.floor(i / 4) + 1,
      blockSize: 4,
      treatmentArm: i % 2 === 0 ? 'Active' : 'Placebo',
      treatmentArmId: i % 2 === 0 ? 'A' : 'B'
    }))
  };
}

describe('SchemaAnalyticsDashboardComponent', () => {
  let component: SchemaAnalyticsDashboardComponent;
  let fixture: ComponentFixture<SchemaAnalyticsDashboardComponent>;
  let mockFacade: ReturnType<typeof buildMockFacade>;
  let viewState: SchemaViewStateService;

  function buildMockFacade() {
    return {
      config: signal(null),
      results: signal<RandomizationResult | null>(null),
      isGenerating: signal(false),
      error: signal<string | null>(null),
      showCodeGenerator: signal(false),
      codeLanguage: signal('R'),
      generateSchema: vi.fn(),
      openCodeGenerator: vi.fn(),
      closeCodeGenerator: vi.fn(),
      clearResults: vi.fn()
    };
  }

  beforeEach(async () => {
    mockFacade = buildMockFacade();

    await TestBed.configureTestingModule({
      imports: [SchemaAnalyticsDashboardComponent],
      providers: [
        { provide: RandomizationEngineFacade, useValue: mockFacade }
      ]
    }).compileComponents();

    viewState = TestBed.inject(SchemaViewStateService);

    fixture = TestBed.createComponent(SchemaAnalyticsDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render the dashboard when results are null', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bg-white')).toBeFalsy();
  });

  it('should render the dashboard when results are available', () => {
    mockFacade.results.set(buildMockResult(12));
    viewState.syncResults(mockFacade.results());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bg-white')).toBeTruthy();
  });

  it('should display "Schema Analytics" heading when results are present', () => {
    mockFacade.results.set(buildMockResult(12));
    viewState.syncResults(mockFacade.results());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Schema Analytics');
  });

  it('should not show active filter HUD when no filter is set', () => {
    mockFacade.results.set(buildMockResult(12));
    viewState.syncResults(mockFacade.results());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Active filter:');
  });

  it('should show active filter HUD when a site filter is applied', () => {
    mockFacade.results.set(buildMockResult(12));
    viewState.syncResults(mockFacade.results());
    viewState.setFilter({ type: 'site', value: 'Site 101' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Active filter:');
    expect(fixture.nativeElement.textContent).toContain('Site 101');
  });

  it('should show "(blinded)" indicator on donut label when not unblinded', () => {
    mockFacade.results.set(buildMockResult(12));
    viewState.syncResults(mockFacade.results());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('(blinded)');
  });

  it('should not show "(blinded)" indicator when unblinded', () => {
    mockFacade.results.set(buildMockResult(12));
    viewState.syncResults(mockFacade.results());
    viewState.toggleBlinding();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('(blinded)');
  });

  it('should clear the filter when "Clear all filters" is clicked', () => {
    mockFacade.results.set(buildMockResult(12));
    viewState.syncResults(mockFacade.results());
    viewState.setFilter({ type: 'treatment', value: 'Active' });
    fixture.detectChanges();

    const clearBtn = fixture.nativeElement.querySelector('button[aria-label="Remove filter"]');
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
    fixture.detectChanges();

    expect(viewState.activeFilter()).toBeNull();
  });
});
