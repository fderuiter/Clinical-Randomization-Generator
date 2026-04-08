import { TestBed } from '@angular/core/testing';
import { SchemaViewStateService } from './schema-view-state.service';
import { RandomizationResult } from '../../core/models/randomization.model';

function buildResult(count: number): RandomizationResult {
  return {
    metadata: {
      protocolId: 'TEST-001',
      studyName: 'Test Study',
      phase: 'Phase II',
      seed: '42',
      generatedAt: '2024-01-01T00:00:00.000Z',
      strata: [],
      config: {} as never
    },
    schema: Array.from({ length: count }, (_, i) => ({
      subjectId: `S-${i + 1}`,
      site: i % 2 === 0 ? 'Site A' : 'Site B',
      stratum: {},
      stratumCode: '',
      blockNumber: Math.floor(i / 4) + 1,
      blockSize: 4,
      treatmentArm: i % 2 === 0 ? 'Active' : 'Placebo',
      treatmentArmId: i % 2 === 0 ? 'A' : 'B'
    }))
  };
}

describe('SchemaViewStateService', () => {
  let service: SchemaViewStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SchemaViewStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with isUnblinded = false', () => {
    expect(service.isUnblinded()).toBe(false);
  });

  it('should toggle isUnblinded via toggleBlinding()', () => {
    service.toggleBlinding();
    expect(service.isUnblinded()).toBe(true);
    service.toggleBlinding();
    expect(service.isUnblinded()).toBe(false);
  });

  it('should start with no active filter', () => {
    expect(service.activeFilter()).toBeNull();
  });

  it('should start with empty filteredSchema', () => {
    expect(service.filteredSchema()).toEqual([]);
  });

  it('should return full schema when no filter is active', () => {
    const result = buildResult(10);
    service.syncResults(result);
    expect(service.filteredSchema().length).toBe(10);
  });

  it('should clear the active filter when syncResults is called', () => {
    service.setFilter({ type: 'site', value: 'Site A' });
    expect(service.activeFilter()).not.toBeNull();

    service.syncResults(buildResult(5));
    expect(service.activeFilter()).toBeNull();
  });

  it('should filter by site when a site filter is active', () => {
    service.syncResults(buildResult(10));
    service.setFilter({ type: 'site', value: 'Site A' });

    const filtered = service.filteredSchema();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(r => r.site === 'Site A')).toBe(true);
  });

  it('should filter by treatment arm when a treatment filter is active', () => {
    service.syncResults(buildResult(10));
    service.setFilter({ type: 'treatment', value: 'Active' });

    const filtered = service.filteredSchema();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(r => r.treatmentArm === 'Active')).toBe(true);
  });

  it('should return all rows after clearing a filter via clearFilter()', () => {
    const result = buildResult(10);
    service.syncResults(result);
    service.setFilter({ type: 'site', value: 'Site A' });
    expect(service.filteredSchema().length).toBeLessThan(10);

    service.clearFilter();
    expect(service.filteredSchema().length).toBe(10);
  });

  it('should update filteredCount reactively', () => {
    service.syncResults(buildResult(10));
    const totalCount = service.filteredCount();
    expect(totalCount).toBe(10);

    service.setFilter({ type: 'site', value: 'Site A' });
    expect(service.filteredCount()).toBeLessThan(totalCount);
  });

  it('should return empty array when syncResults is called with null', () => {
    service.syncResults(buildResult(5));
    expect(service.filteredSchema().length).toBe(5);

    service.syncResults(null);
    expect(service.filteredSchema()).toEqual([]);
  });
});
