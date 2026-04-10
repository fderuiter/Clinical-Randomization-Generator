import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SchemaVerificationComponent, RowDiscrepancy } from './schema-verification.component';
import { GeneratedSchema, RandomizationResult } from '../../core/models/randomization.model';
import { generateRandomizationSchema } from '../../randomization-engine/core/randomization-algorithm';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function buildMockResult(overrides: Partial<RandomizationResult> = {}): RandomizationResult {
  const base: RandomizationResult = {
    metadata: {
      protocolId: 'TEST-001',
      studyName: 'Test Study',
      phase: 'Phase II',
      seed: 'test-seed-42',
      generatedAt: '2024-01-01T00:00:00.000Z',
      strata: [],
      auditHash: 'aabbcc',
      config: {
        protocolId: 'TEST-001',
        studyName: 'Test Study',
        phase: 'Phase II',
        arms: [
          { id: 'A', name: 'Treatment A', ratio: 1 },
          { id: 'B', name: 'Treatment B', ratio: 1 },
        ],
        sites: ['Site 01'],
        strata: [],
        blockSizes: [2],
        stratumCaps: [{ levels: [''], cap: 4 }],
        seed: 'test-seed-42',
        subjectIdMask: '{SEQ:3}',
      },
    },
    schema: [],
    ...overrides,
  };
  return base;
}

function buildSchema(count: number): GeneratedSchema[] {
  return Array.from({ length: count }, (_, i) => ({
    subjectId: `S-${String(i + 1).padStart(3, '0')}`,
    site: 'Site 01',
    stratum: {},
    stratumCode: '',
    blockNumber: Math.floor(i / 2) + 1,
    blockSize: 2,
    treatmentArm: i % 2 === 0 ? 'Treatment A' : 'Treatment B',
    treatmentArmId: i % 2 === 0 ? 'A' : 'B',
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SchemaVerificationComponent', () => {
  let component: SchemaVerificationComponent;
  let fixture: ComponentFixture<SchemaVerificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchemaVerificationComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SchemaVerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in idle state', () => {
    expect(component.status()).toBe('idle');
    expect(component.fileName()).toBeNull();
    expect(component.errorMessage()).toBeNull();
    expect(component.discrepancies()).toHaveLength(0);
  });

  it('should render upload zone', () => {
    const zone = fixture.nativeElement.querySelector('[data-testid="upload-zone"]');
    expect(zone).toBeTruthy();
  });

  it('should render file input', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="file-input"]');
    expect(input).toBeTruthy();
  });

  // ── verify() method unit tests ────────────────────────────────────────────

  it('should set error status for non-object input', () => {
    component.verify('not an object');
    expect(component.status()).toBe('error');
    expect(component.errorMessage()).toContain('Invalid file structure');
  });

  it('should set error status for null input', () => {
    component.verify(null);
    expect(component.status()).toBe('error');
    expect(component.errorMessage()).toContain('Invalid file structure');
  });

  it('should set error when metadata is missing', () => {
    component.verify({ schema: [] });
    expect(component.status()).toBe('error');
    expect(component.errorMessage()).toContain('Invalid file structure');
  });

  it('should set error when metadata.config is missing', () => {
    component.verify({ metadata: { seed: 'x' }, schema: [] });
    expect(component.status()).toBe('error');
    expect(component.errorMessage()).toContain('Invalid file structure');
  });

  it('should set error when schema array is missing', () => {
    component.verify({ metadata: { config: {} } });
    expect(component.status()).toBe('error');
    expect(component.errorMessage()).toContain('Invalid file structure');
  });

  it('should pass for a valid reproducible result', () => {
    // Use a simple config that won't error
    const config = buildMockResult().metadata.config;
    // Generate a fresh result then verify it against itself → should always pass
    const freshResult: RandomizationResult = generateRandomizationSchema(config);
    component.verify(freshResult);
    fixture.detectChanges();

    expect(component.status()).toBe('pass');
    expect(fixture.nativeElement.querySelector('[data-testid="pass-report"]')).toBeTruthy();
  });

  // ── diff() method unit tests ──────────────────────────────────────────────

  describe('diff()', () => {
    it('should return empty array when schemas are identical', () => {
      const schema = buildSchema(4);
      const result = component.diff(schema, [...schema.map(r => ({ ...r }))]);
      expect(result).toHaveLength(0);
    });

    it('should detect row count mismatch', () => {
      const baseline = buildSchema(4);
      const fresh = buildSchema(6);
      const result = component.diff(baseline, fresh);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].field).toBe('Row Count');
      expect(result[0].expected).toBe(4);
      expect(result[0].actual).toBe(6);
    });

    it('should detect treatmentArmId mismatch', () => {
      const baseline = buildSchema(2);
      const fresh = buildSchema(2).map((r, i) => ({
        ...r,
        treatmentArmId: i === 0 ? 'B' : 'A', // swap
        treatmentArm: i === 0 ? 'Treatment B' : 'Treatment A',
      }));
      const result = component.diff(baseline, fresh);
      const armDiscs = result.filter(d => d.field === 'treatmentArmId');
      expect(armDiscs.length).toBeGreaterThan(0);
    });

    it('should detect subjectId mismatch', () => {
      const baseline = buildSchema(2);
      const fresh = baseline.map((r, i) => ({
        ...r,
        subjectId: i === 0 ? 'WRONG-ID' : r.subjectId,
      }));
      const result = component.diff(baseline, fresh);
      const subjectDiscs = result.filter(d => d.field === 'subjectId');
      expect(subjectDiscs).toHaveLength(1);
      expect(subjectDiscs[0].rowIndex).toBe(0);
      expect(subjectDiscs[0].expected).toBe(baseline[0].subjectId);
      expect(subjectDiscs[0].actual).toBe('WRONG-ID');
    });

    it('should detect blockNumber mismatch', () => {
      const baseline = buildSchema(2);
      const fresh = baseline.map((r, i) => ({
        ...r,
        blockNumber: i === 1 ? 99 : r.blockNumber,
      }));
      const result = component.diff(baseline, fresh);
      const blockDiscs = result.filter(d => d.field === 'blockNumber');
      expect(blockDiscs).toHaveLength(1);
      expect(blockDiscs[0].rowIndex).toBe(1);
    });

    it('should detect stratumCode mismatch', () => {
      const baseline = buildSchema(2);
      const fresh = baseline.map((r, i) => ({
        ...r,
        stratumCode: i === 0 ? 'WRONG' : r.stratumCode,
      }));
      const result = component.diff(baseline, fresh);
      const stratumDiscs = result.filter(d => d.field === 'stratumCode');
      expect(stratumDiscs).toHaveLength(1);
    });

    it('should not short-circuit on first mismatch — collect all discrepancies', () => {
      const baseline = buildSchema(4);
      const fresh = baseline.map(r => ({
        ...r,
        treatmentArmId: 'WRONG',
      }));
      const result = component.diff(baseline, fresh);
      // Every row has a mismatch on treatmentArmId
      expect(result.filter(d => d.field === 'treatmentArmId').length).toBe(4);
    });

    it('should halt with length error and not do row iteration when lengths differ', () => {
      const baseline = buildSchema(3);
      const fresh = buildSchema(5);
      const result = component.diff(baseline, fresh);
      // Only the length discrepancy should be present
      expect(result).toHaveLength(1);
      expect(result[0].field).toBe('Row Count');
    });
  });

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  it('should set isDragging true on dragover', () => {
    const event = { preventDefault: vi.fn() } as unknown as DragEvent;
    component.onDragOver(event);
    expect(component.isDragging()).toBe(true);
  });

  it('should set isDragging false on dragleave', () => {
    component.isDragging.set(true);
    component.onDragLeave();
    expect(component.isDragging()).toBe(false);
  });

  // ── Template rendering ────────────────────────────────────────────────────

  it('should show fail report and discrepancy table on fail status', () => {
    const baseline = buildSchema(2);
    const discs: RowDiscrepancy[] = [{
      rowIndex: 0,
      subjectId: 'S-001',
      field: 'treatmentArmId',
      expected: 'A',
      actual: 'B',
    }];
    component.status.set('fail');
    component.discrepancies.set(discs);
    component.uploadedSchema.set(baseline);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="fail-report"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="discrepancy-table"]')).toBeTruthy();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="discrepancy-row"]');
    expect(rows.length).toBe(1);
  });

  it('should show pass report on pass status', () => {
    component.status.set('pass');
    component.uploadedSchema.set(buildSchema(4));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="pass-report"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Reproducibility Verified');
    expect(fixture.nativeElement.textContent).toContain('4');
  });

  it('should show error banner on error status', () => {
    component.status.set('error');
    component.errorMessage.set('Invalid file structure: Missing RandomizationConfig metadata');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="error-banner"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Invalid file structure');
  });
});
