/* eslint-disable @typescript-eslint/no-explicit-any */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultsGridComponent } from './results-grid.component';
import { RandomizationResult } from '../../core/models/randomization.model';
import { By } from '@angular/platform-browser';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { ToastService } from '../../../core/services/toast.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

vi.mock('jspdf', () => {
  return {
    default: class {
      setFontSize = vi.fn();
      text = vi.fn();
      setTextColor = vi.fn();
      save = vi.fn();
    }
  };
});
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

describe('ResultsGridComponent (domain)', () => {
  let component: ResultsGridComponent;
  let fixture: ComponentFixture<ResultsGridComponent>;
  let mockFacade: unknown;
  let mockToastService: { showInfo: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn>; showSuccess: ReturnType<typeof vi.fn> };

  const generateMockData = (count: number): RandomizationResult => ({
    metadata: {
      protocolId: 'TEST-123',
      studyName: 'Test Study',
      phase: 'Phase II',
      seed: '12345',
      generatedAt: '2023-01-01T00:00:00.000Z',
      strata: [{ id: 'site', name: 'Site', levels: ['Site 1', 'Site 2', 'Site 3'] }],
      auditHash: 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233',
      config: {
        protocolId: 'TEST-123',
        studyName: 'Test Study',
        phase: 'Phase II',
        arms: [{ id: 't1', name: 'Active', ratio: 1 }],
        sites: ['Site 1'],
        blockSizes: [4],
        strata: [{ id: 'site', name: 'Site', levels: ['Site 1', 'Site 2', 'Site 3'] }],
        stratumCaps: [],
        seed: '12345',
        subjectIdMask: 'SUBJ-XXXX'
      }
    },
    schema: Array.from({ length: count }, (_, i) => ({
      subjectId: `SUBJ-${i + 1}`,
      site: `Site ${i % 3 + 1}`,
      stratum: { site: `Site ${i % 3 + 1}` },
      stratumCode: 'site-1',
      blockNumber: Math.floor(i / 4) + 1,
      blockSize: 4,
      treatmentArmId: i % 2 === 0 ? 't1' : 't2',
      treatmentArm: i % 2 === 0 ? 'Active' : 'Placebo'
    }))
  });

  beforeEach(async () => {
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    mockFacade = {
      config: signal(null),
      results: signal(null),
      isGenerating: signal(false),
      error: signal(null),
      showCodeGenerator: signal(false),
      codeLanguage: signal('R'),
      generateSchema: vi.fn(),
      openCodeGenerator: vi.fn(),
      closeCodeGenerator: vi.fn(),
      clearResults: vi.fn()
    };

    mockToastService = {
      showInfo: vi.fn(),
      showError: vi.fn(),
      showSuccess: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ResultsGridComponent],
      providers: [
        { provide: RandomizationEngineFacade, useValue: mockFacade },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ResultsGridComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── processedData: Filtering ──────────────────────────────────────────────

  describe('processedData Filtering', () => {
    it('should return all items when no filters are active', () => {
      const mockResult = generateMockData(12);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      expect(component.processedData().length).toBe(12);
    });

    it('should filter by site (case-insensitive partial match)', () => {
      const mockResult = generateMockData(12);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.openColumnFilter('site');
      component.updateColumnFilter('Site 1');
      fixture.detectChanges();

      const results = component.processedData();
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => expect(r.site.toLowerCase()).toContain('site 1'));
    });

    it('should filter by treatmentArm', () => {
      const mockResult = generateMockData(12);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.openColumnFilter('treatmentArm');
      component.updateColumnFilter('Active');
      fixture.detectChanges();

      const results = component.processedData();
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => expect(r.treatmentArm.toLowerCase()).toContain('active'));
    });

    it('should filter by stratum column', () => {
      const mockResult = generateMockData(12);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.openColumnFilter('stratum_site');
      component.updateColumnFilter('Site 2');
      fixture.detectChanges();

      const results = component.processedData();
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => expect(r.stratum['site'].toLowerCase()).toContain('site 2'));
    });

    it('should return empty array when filter matches nothing', () => {
      const mockResult = generateMockData(6);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.openColumnFilter('site');
      component.updateColumnFilter('NONEXISTENT_XYZ');
      fixture.detectChanges();

      expect(component.processedData().length).toBe(0);
    });

    it('should clear a filter and restore full dataset', () => {
      const mockResult = generateMockData(6);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.openColumnFilter('site');
      component.updateColumnFilter('Site 1');
      fixture.detectChanges();
      const filtered = component.processedData().length;

      component.clearColumnFilter('site');
      fixture.detectChanges();
      expect(component.processedData().length).toBeGreaterThan(filtered);
      expect(component.processedData().length).toBe(6);
    });

    it('hasActiveFilter should return true only when filter is non-empty', () => {
      expect(component.hasActiveFilter('site')).toBe(false);

      component.openColumnFilter('site');
      component.updateColumnFilter('Site 1');
      expect(component.hasActiveFilter('site')).toBe(true);

      component.clearColumnFilter('site');
      expect(component.hasActiveFilter('site')).toBe(false);
    });
  });

  // ── processedData: Sorting ────────────────────────────────────────────────

  describe('Sorting', () => {
    it('should default to no sort (direction: none)', () => {
      expect(component.sortState().direction).toBe('none');
      expect(component.sortState().column).toBe('');
    });

    it('toggleSort should switch to asc on first call', () => {
      component.toggleSort('site');
      expect(component.sortState()).toEqual({ column: 'site', direction: 'asc' });
    });

    it('toggleSort should cycle asc → desc → none', () => {
      component.toggleSort('site');
      expect(component.sortState().direction).toBe('asc');

      component.toggleSort('site');
      expect(component.sortState().direction).toBe('desc');

      component.toggleSort('site');
      expect(component.sortState()).toEqual({ column: '', direction: 'none' });
    });

    it('switching to a different column resets direction to asc', () => {
      component.toggleSort('site');
      component.toggleSort('site'); // desc
      component.toggleSort('treatmentArm'); // different column → asc
      expect(component.sortState()).toEqual({ column: 'treatmentArm', direction: 'asc' });
    });

    it('should sort by site ascending', () => {
      const mockResult = generateMockData(12);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.toggleSort('site');
      const sites = component.processedData().map(r => r.site);
      expect(sites).toEqual([...sites].sort());
    });

    it('should sort by site descending', () => {
      const mockResult = generateMockData(12);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.toggleSort('site');
      component.toggleSort('site');
      const sites = component.processedData().map(r => r.site);
      expect(sites).toEqual([...sites].sort().reverse());
    });

    it('should sort by blockNumber ascending (numeric)', () => {
      const mockResult = generateMockData(12);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.toggleSort('blockNumber');
      const blocks = component.processedData().map(r => r.blockNumber);
      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i]).toBeGreaterThanOrEqual(blocks[i - 1]);
      }
    });

    it('should sort by treatmentArm', () => {
      const mockResult = generateMockData(8);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.toggleSort('treatmentArm');
      const arms = component.processedData().map(r => r.treatmentArm);
      expect(arms).toEqual([...arms].sort());
    });
  });

  // ── Blinding ──────────────────────────────────────────────────────────────

  describe('Blinding', () => {
    it('should default to blinded (isUnblinded = false)', () => {
      const mockResult = generateMockData(5);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      expect(component.isUnblinded()).toBe(false);
    });

    it('processedData should contain all rows regardless of blinding state', () => {
      const mockResult = generateMockData(5);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      expect(component.processedData().length).toBe(5);

      component.toggleBlinding();
      fixture.detectChanges();

      expect(component.isUnblinded()).toBe(true);
      expect(component.processedData().length).toBe(5);
    });

    it('should show actual treatment names when unblinded (grouped view DOM)', () => {
      const mockResult = generateMockData(4);
      mockResult.schema.forEach(r => { r.blockNumber = 1; r.stratumCode = 'SC1'; r.site = 'Site 1'; r.stratum = { site: 'Site 1' }; });
      (mockFacade as any).results.set(mockResult);
      component.viewMode.set('grouped');
      component.toggleBlinding();
      fixture.detectChanges();

      expect(component.isUnblinded()).toBe(true);
      const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
      const dataRows = rows.filter(r => r.nativeElement.getAttribute('data-testid') === 'result-row');
      const firstDataRow = dataRows[0];
      const armCell = firstDataRow.query(By.css('[data-testid="result-arm-cell"]'));
      expect(armCell.nativeElement.textContent.trim()).not.toBe('*** BLINDED ***');
    });

    it('should show blinded text in grouped view when blinded', () => {
      const mockResult = generateMockData(4);
      mockResult.schema.forEach(r => { r.blockNumber = 1; r.stratumCode = 'SC1'; r.site = 'Site 1'; r.stratum = { site: 'Site 1' }; });
      (mockFacade as any).results.set(mockResult);
      component.viewMode.set('grouped');
      fixture.detectChanges();

      expect(component.isUnblinded()).toBe(false);
      const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
      const dataRows = rows.filter(r => r.nativeElement.getAttribute('data-testid') === 'result-row');
      const armCell = dataRows[0].query(By.css('[data-testid="result-arm-cell"]'));
      expect(armCell.nativeElement.textContent.trim()).toBe('*** BLINDED ***');
    });
  });

  // ── Export Spies ──────────────────────────────────────────────────────────

  describe('Export Spies', () => {
    it('should trigger exportCsv when CSV button is clicked', () => {
      const mockResult = generateMockData(5);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      const spy = vi.spyOn(component, 'exportCsv');
      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const csvButton = buttons.find(b => b.nativeElement.textContent.trim().includes('CSV'));
      expect(csvButton).toBeTruthy();
      csvButton?.triggerEventHandler('click', null);
      expect(spy).toHaveBeenCalled();
    });

    it('should trigger exportPdf when PDF button is clicked', () => {
      const mockResult = generateMockData(5);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      const spy = vi.spyOn(component, 'exportPdf').mockImplementation(() => { /* no-op */ });
      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const pdfButton = buttons.find(b => b.nativeElement.textContent.trim().includes('PDF'));
      expect(pdfButton).toBeTruthy();
      pdfButton?.triggerEventHandler('click', null);
      expect(spy).toHaveBeenCalled();
    });

    it('should trigger exportJson when JSON button is clicked', () => {
      const mockResult = generateMockData(5);
      (mockFacade as any).results.set(mockResult);
      component.isUnblinded.set(true);
      fixture.detectChanges();

      const spy = vi.spyOn(component, 'exportJson').mockImplementation(() => { /* no-op */ });
      const jsonButton = fixture.debugElement.query(By.css('[data-testid="export-json-btn"]'));
      expect(jsonButton).toBeTruthy();
      expect(jsonButton.nativeElement.disabled).toBe(false);
      jsonButton?.triggerEventHandler('click', null);
      expect(spy).toHaveBeenCalled();
    });

    it('should trigger exportXlsx when Excel button is clicked', () => {
      const mockResult = generateMockData(5);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      const spy = vi.spyOn(component, 'exportXlsx').mockResolvedValue(undefined);
      const xlsxButton = fixture.debugElement.query(By.css('[data-testid="export-xlsx-btn"]'));
      expect(xlsxButton).toBeTruthy();
      xlsxButton?.triggerEventHandler('click', null);
      expect(spy).toHaveBeenCalled();
    });

    it('should not throw when exportXlsx is called with no results', async () => {
      (mockFacade as any).results.set(null);
      fixture.detectChanges();
      await expect(component.exportXlsx()).resolves.toBeUndefined();
    });

    it('should download a valid RandomizationResult JSON when exportJson is called', () => {
      vi.useFakeTimers();
      const mockResult = generateMockData(3);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.isUnblinded.set(true);

      const appendSpy = vi.spyOn(document.body, 'appendChild');
      const removeSpy = vi.spyOn(document.body, 'removeChild');

      component.exportJson();

      // A link element was appended immediately
      expect(appendSpy).toHaveBeenCalled();

      // The link that was appended should have the correct download filename
      const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchor.getAttribute('download')).toBe(
        `randomization_${mockResult.metadata.protocolId}_${mockResult.metadata.seed}.json`
      );

      // removeChild and revokeObjectURL are deferred by 100ms
      expect(removeSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(removeSpy).toHaveBeenCalled();

      appendSpy.mockRestore();
      removeSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should show a toast and not download when exportJson is called while blinded', () => {
      const mockResult = generateMockData(3);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      component.isUnblinded.set(false);

      const appendSpy = vi.spyOn(document.body, 'appendChild');

      component.exportJson();

      expect(mockToastService.showInfo).toHaveBeenCalled();
      expect(appendSpy).not.toHaveBeenCalled();

      appendSpy.mockRestore();
    });

    it('should not throw when exportJson is called with no results', () => {
      (mockFacade as any).results.set(null);
      fixture.detectChanges();
      expect(() => component.exportJson()).not.toThrow();
    });
  });

  // ── Group by Block view ───────────────────────────────────────────────────

  describe('Group by Block view', () => {
    it('should default to flat view mode', () => {
      fixture.detectChanges();
      expect(component.viewMode()).toBe('flat');
    });

    it('should toggle to grouped mode when "Group by Block" button is clicked', () => {
      const mockResult = generateMockData(8);
      (mockFacade as any).results.set(mockResult);
      fixture.detectChanges();

      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const groupButton = buttons.find(b => b.nativeElement.textContent.trim() === 'Group by Block');
      expect(groupButton).toBeTruthy();
      groupButton?.triggerEventHandler('click', null);
      fixture.detectChanges();

      expect(component.viewMode()).toBe('grouped');
    });

    it('should toggle back to flat mode when "Flat List" button is clicked', () => {
      const mockResult = generateMockData(8);
      (mockFacade as any).results.set(mockResult);
      component.viewMode.set('grouped');
      fixture.detectChanges();

      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const flatButton = buttons.find(b => b.nativeElement.textContent.trim() === 'Flat List');
      expect(flatButton).toBeTruthy();
      flatButton?.triggerEventHandler('click', null);
      fixture.detectChanges();

      expect(component.viewMode()).toBe('flat');
    });

    describe('groupedRows computed signal', () => {
      const makeSchema = (overrides: Partial<{
        subjectId: string; site: string; stratum: Record<string, string>;
        stratumCode: string; blockNumber: number; blockSize: number;
        treatmentArmId: string; treatmentArm: string;
      }>[]) => {
        const baseRow = {
          subjectId: 'S1', site: 'Site 1', stratum: { site: 'Site 1' },
          stratumCode: 'SC1', blockNumber: 1, blockSize: 4,
          treatmentArmId: 'a1', treatmentArm: 'Active'
        };
        return overrides.map(o => ({ ...baseRow, ...o }));
      };

      it('should produce header, data rows, and summary for a single block', () => {
        const schema = makeSchema([
          { subjectId: 'S1', treatmentArm: 'Active' },
          { subjectId: 'S2', treatmentArm: 'Placebo', treatmentArmId: 'a2' },
          { subjectId: 'S3', treatmentArm: 'Active' },
          { subjectId: 'S4', treatmentArm: 'Placebo', treatmentArmId: 'a2' },
        ]);
        (mockFacade as any).results.set({ ...generateMockData(0), schema });
        fixture.detectChanges();

        const rows = component.groupedRows();
        expect(rows[0].type).toBe('header');
        expect(rows[1].type).toBe('data');
        expect(rows[2].type).toBe('data');
        expect(rows[3].type).toBe('data');
        expect(rows[4].type).toBe('data');
        expect(rows[5].type).toBe('summary');
        expect(rows.length).toBe(6);
      });

      it('should group distinct blocks into separate header/data/summary triplets', () => {
        const schema = makeSchema([
          { subjectId: 'S1', blockNumber: 1, site: 'Site 1', stratumCode: 'SC1', treatmentArm: 'Active' },
          { subjectId: 'S2', blockNumber: 1, site: 'Site 1', stratumCode: 'SC1', treatmentArm: 'Placebo', treatmentArmId: 'a2' },
          { subjectId: 'S3', blockNumber: 2, site: 'Site 1', stratumCode: 'SC1', treatmentArm: 'Active' },
          { subjectId: 'S4', blockNumber: 2, site: 'Site 1', stratumCode: 'SC1', treatmentArm: 'Placebo', treatmentArmId: 'a2' },
        ]);
        (mockFacade as any).results.set({ ...generateMockData(0), schema });
        fixture.detectChanges();

        const rows = component.groupedRows();
        expect(rows.length).toBe(8);
        expect(rows[0].type).toBe('header');
        expect(rows[3].type).toBe('summary');
        expect(rows[4].type).toBe('header');
        expect(rows[7].type).toBe('summary');
      });

      it('should use a compound key so blocks with same number but different sites stay separate', () => {
        const schema = makeSchema([
          { subjectId: 'S1', blockNumber: 1, site: 'Site 1', stratumCode: 'SC1', treatmentArm: 'Active' },
          { subjectId: 'S2', blockNumber: 1, site: 'Site 2', stratumCode: 'SC2', treatmentArm: 'Active' },
        ]);
        (mockFacade as any).results.set({ ...generateMockData(0), schema });
        fixture.detectChanges();

        const rows = component.groupedRows();
        expect(rows.length).toBe(6);
        const headers = rows.filter(r => r.type === 'header') as unknown[];
        expect((headers[0] as any).site).toBe('Site 1');
        expect((headers[1] as any).site).toBe('Site 2');
      });

      it('summary tallies should be correct', () => {
        const schema = makeSchema([
          { subjectId: 'S1', treatmentArm: 'Active' },
          { subjectId: 'S2', treatmentArm: 'Placebo', treatmentArmId: 'a2' },
          { subjectId: 'S3', treatmentArm: 'Active' },
          { subjectId: 'S4', treatmentArm: 'Placebo', treatmentArmId: 'a2' },
        ]);
        (mockFacade as any).results.set({ ...generateMockData(0), schema });
        fixture.detectChanges();

        const rows = component.groupedRows();
        const summary = rows[rows.length - 1] as unknown;
        expect((summary as any).type).toBe('summary');
        expect((summary as any).tallies['Active']).toBe(2);
        expect((summary as any).tallies['Placebo']).toBe(2);
        expect((summary as any).totalSubjects).toBe(4);
        expect((summary as any).isIncomplete).toBe(false);
      });

      it('should flag incomplete blocks when totalSubjects < blockSize', () => {
        const schema = makeSchema([
          { subjectId: 'S1', blockSize: 4, treatmentArm: 'Active' },
          { subjectId: 'S2', blockSize: 4, treatmentArm: 'Placebo', treatmentArmId: 'a2' },
        ]);
        (mockFacade as any).results.set({ ...generateMockData(0), schema });
        fixture.detectChanges();

        const rows = component.groupedRows();
        const summary = rows[rows.length - 1] as unknown;
        expect((summary as any).isIncomplete).toBe(true);
        expect((summary as any).totalSubjects).toBe(2);
        expect((summary as { blockSize: number }).blockSize).toBe(4);
      });
    });

    describe('getSummaryBalanceText', () => {
      it('should format tallies correctly', () => {
        expect(component.getSummaryBalanceText({ Active: 2, Placebo: 2 })).toBe('2 Active, 2 Placebo');
        expect(component.getSummaryBalanceText({ Active: 3 })).toBe('3 Active');
      });
    });

    describe('columnCount', () => {
      it('should count 5 fixed columns plus strata columns', () => {
        const data = generateMockData(1);
        (mockFacade as any).results.set(data);
        fixture.detectChanges();
        expect(component.columnCount()).toBe(6);
      });

      it('should return 5 when no strata are defined', () => {
        const data = generateMockData(1);
        data.metadata.strata = [];
        (mockFacade as any).results.set(data);
        fixture.detectChanges();
        expect(component.columnCount()).toBe(5);
      });
    });

    describe('grouped view DOM rendering', () => {
      it('should render header and summary rows in grouped mode (blinded)', () => {
        const mockResult = generateMockData(4);
        mockResult.schema.forEach(r => { r.blockNumber = 1; r.stratumCode = 'SC1'; r.site = 'Site 1'; r.stratum = { site: 'Site 1' }; });
        (mockFacade as any).results.set(mockResult);
        component.viewMode.set('grouped');
        fixture.detectChanges();

        const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
        expect(rows.length).toBe(6);

        const summaryRow = rows[rows.length - 1];
        expect(summaryRow.nativeElement.textContent).toContain('Subjects (Blinded)');
      });

      it('should render unblinded tallies in summary row when unblinded', () => {
        const mockResult = generateMockData(4);
        mockResult.schema.forEach(r => { r.blockNumber = 1; r.stratumCode = 'SC1'; r.site = 'Site 1'; r.stratum = { site: 'Site 1' }; });
        (mockFacade as any).results.set(mockResult);
        component.viewMode.set('grouped');
        component.toggleBlinding();
        fixture.detectChanges();

        const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
        const summaryRow = rows[rows.length - 1];
        expect(summaryRow.nativeElement.textContent).toContain('Balance:');
        expect(summaryRow.nativeElement.textContent).not.toContain('Blinded');
      });

      it('should show an incomplete block warning when block has fewer subjects than blockSize', () => {
        const mockResult = generateMockData(2);
        mockResult.schema.forEach(r => { r.blockNumber = 1; r.stratumCode = 'SC1'; r.site = 'Site 1'; r.stratum = { site: 'Site 1' }; });
        (mockFacade as any).results.set(mockResult);
        component.viewMode.set('grouped');
        fixture.detectChanges();

        const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
        const summaryRow = rows[rows.length - 1];
        expect(summaryRow.nativeElement.textContent).toContain('Incomplete Block');
      });
    });
  });
});
