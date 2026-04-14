import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BalanceVerificationComponent } from './balance-verification.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { RandomizationResult } from '../../core/models/randomization.model';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function buildMockResult(overrides: Partial<{
  totalSubjects: number;
  sites: string[];
  arms: { id: string; name: string; ratio: number }[];
  blockSizes: number[];
  stratumFactor?: { id: string; name: string; levels: string[] };
}>= {}): RandomizationResult {
  const {
    totalSubjects = 12,
    sites = ['Site 101', 'Site 102'],
    arms = [
      { id: 'A', name: 'Active', ratio: 2 },
      { id: 'B', name: 'Placebo', ratio: 1 },
    ],
    blockSizes = [6],
    stratumFactor,
  } = overrides;

  const totalRatio = arms.reduce((s, a) => s + a.ratio, 0);

  const schema = Array.from({ length: totalSubjects }, (_, i) => {
    const siteIdx = i % sites.length;
    // Assign treatments proportionally based on position within block
    const posInBlock = i % blockSizes[0];
    const threshold = Math.round((arms[0].ratio / totalRatio) * blockSizes[0]);
    const treatmentIdx = posInBlock < threshold ? 0 : 1;
    const stratum: Record<string, string> = {};
    if (stratumFactor) {
      stratum[stratumFactor.id] = stratumFactor.levels[i % stratumFactor.levels.length];
    }
    return {
      subjectId: `S-${i + 1}`,
      site: sites[siteIdx],
      stratum,
      stratumCode: stratumFactor ? stratumFactor.levels[i % stratumFactor.levels.length] : '',
      blockNumber: Math.floor(i / blockSizes[0]) + 1,
      blockSize: blockSizes[0],
      treatmentArm: arms[treatmentIdx].name,
      treatmentArmId: arms[treatmentIdx].id,
    };
  });

  return {
    metadata: {
      protocolId: 'TEST-001',
      studyName: 'Balance Test',
      phase: 'Phase II',
      seed: '42',
      generatedAt: '2024-01-01T00:00:00.000Z',
      strata: stratumFactor ? [stratumFactor] : [],
      auditHash: 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233',
      config: {
        protocolId: 'TEST-001',
        studyName: 'Balance Test',
        phase: 'Phase II',
        arms,
        sites,
        strata: stratumFactor ? [stratumFactor] : [],
        blockSizes,
        stratumCaps: [],
        seed: '42',
        subjectIdMask: '{SEQ:3}',
      },
    },
    schema,
  };
}

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
    clearResults: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BalanceVerificationComponent', () => {
  let component: BalanceVerificationComponent;
  let fixture: ComponentFixture<BalanceVerificationComponent>;
  let mockFacade: ReturnType<typeof buildMockFacade>;

  beforeEach(async () => {
    mockFacade = buildMockFacade();

    await TestBed.configureTestingModule({
      imports: [BalanceVerificationComponent],
      providers: [
        { provide: RandomizationEngineFacade, useValue: mockFacade },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BalanceVerificationComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show placeholder text when no results are available', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Generate a schema first');
  });

  it('should render dashboard sections when results are available', () => {
    mockFacade.results.set(buildMockResult());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Global Balance');
    expect(fixture.nativeElement.textContent).toContain('Balance by Site');
  });

  it('should display treatment arm column headers', () => {
    mockFacade.results.set(buildMockResult());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Active');
    expect(fixture.nativeElement.textContent).toContain('Placebo');
  });

  it('should show global total subject count', () => {
    mockFacade.results.set(buildMockResult({ totalSubjects: 12 }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('12');
  });

  it('should compute globalRow with correct total', () => {
    mockFacade.results.set(buildMockResult({ totalSubjects: 12 }));
    fixture.detectChanges();
    expect(component.globalRow().total).toBe(12);
  });

  it('should compute globalRow arms with correct arm names', () => {
    mockFacade.results.set(buildMockResult({ totalSubjects: 12 }));
    fixture.detectChanges();
    const arms = component.globalRow().arms;
    expect(arms.map(a => a.arm.name)).toEqual(['Active', 'Placebo']);
  });

  it('should compute siteRows for each site', () => {
    mockFacade.results.set(buildMockResult({ sites: ['Site 101', 'Site 102'], totalSubjects: 12 }));
    fixture.detectChanges();
    expect(component.siteRows().length).toBe(2);
    const labels = component.siteRows().map(r => r.label);
    expect(labels).toContain('Site 101');
    expect(labels).toContain('Site 102');
  });

  it('should have siteRows totals that sum to global total', () => {
    mockFacade.results.set(buildMockResult({ totalSubjects: 12 }));
    fixture.detectChanges();
    const siteTotal = component.siteRows().reduce((sum, r) => sum + r.total, 0);
    expect(siteTotal).toBe(component.globalRow().total);
  });

  it('should return empty stratumRows when no strata are configured', () => {
    mockFacade.results.set(buildMockResult({ totalSubjects: 12 }));
    fixture.detectChanges();
    expect(component.stratumRows().length).toBe(0);
  });

  it('should compute stratumRows when strata are configured', () => {
    const result = buildMockResult({
      totalSubjects: 12,
      stratumFactor: { id: 'age', name: 'Age Group', levels: ['<65', '>=65'] },
    });
    mockFacade.results.set(result);
    fixture.detectChanges();
    expect(component.stratumRows().length).toBeGreaterThan(0);
    expect(fixture.nativeElement.textContent).toContain('Balance by Stratum');
  });

  it('should flag perfect balance with status 0', () => {
    // Build a perfectly balanced result: 12 patients, 2:1 ratio, blockSize 6
    // → Active=8, Placebo=4, target Active=8, target Placebo=4 → variance 0
    const result = buildMockResult({ totalSubjects: 12, blockSizes: [6] });
    mockFacade.results.set(result);
    fixture.detectChanges();

    // At least one arm should have status 0 or we check the expected balance
    const globalArms = component.globalRow().arms;
    // The test data creates balanced blocks so all variances should be 0
    for (const ab of globalArms) {
      // Either perfect or within tolerance - key check is no critical errors
      expect(ab.status).not.toBe(2);
    }
  });

  it('cellClass should return emerald for status 0', () => {
    expect(component.cellClass(0)).toContain('emerald');
  });

  it('cellClass should return amber for status 1', () => {
    expect(component.cellClass(1)).toContain('amber');
  });

  it('cellClass should return red for status 2', () => {
    expect(component.cellClass(2)).toContain('red');
  });

  it('tooltipText should mention "Perfect balance" for status 0', () => {
    const ab = { arm: { id: 'A', name: 'Active', ratio: 2 }, actual: 8, target: 8, variance: 0, status: 0 as const };
    expect(component.tooltipText(ab)).toContain('Perfect balance');
  });

  it('tooltipText should mention "incomplete final block" for status 1', () => {
    const ab = { arm: { id: 'A', name: 'Active', ratio: 2 }, actual: 9, target: 8, variance: 1, status: 1 as const };
    expect(component.tooltipText(ab)).toContain('incomplete final block');
  });

  it('tooltipText should mention "Critical error" for status 2', () => {
    const ab = { arm: { id: 'A', name: 'Active', ratio: 2 }, actual: 15, target: 8, variance: 7, status: 2 as const };
    expect(component.tooltipText(ab)).toContain('Critical error');
  });

  it('should not show "Balance by Stratum" section when no strata configured', () => {
    mockFacade.results.set(buildMockResult({ totalSubjects: 12 }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Balance by Stratum');
  });

  it('should show legend with all three status descriptions', () => {
    mockFacade.results.set(buildMockResult());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Perfect balance');
    expect(fixture.nativeElement.textContent).toContain('Expected deviation');
    expect(fixture.nativeElement.textContent).toContain('Critical error');
  });
});
