import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultsGridComponent } from './results-grid.component';
import { RandomizationResult } from '../../core/models/randomization.model';
import { By } from '@angular/platform-browser';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
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
  let mockFacade: any;

  const generateMockData = (count: number): RandomizationResult => ({
    metadata: {
      protocolId: 'TEST-123',
      studyName: 'Test Study',
      phase: 'Phase II',
      seed: '12345',
      generatedAt: '2023-01-01T00:00:00.000Z',
      strata: [{ id: 'site', name: 'Site', levels: ['Site 1', 'Site 2', 'Site 3'] }],
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
    globalThis.URL.createObjectURL = vi.fn() as any;

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

    await TestBed.configureTestingModule({
      imports: [ResultsGridComponent],
      providers: [
        { provide: RandomizationEngineFacade, useValue: mockFacade }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ResultsGridComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Pagination', () => {
    it('should compute totalItems, totalPages, startIndex, endIndex and paginatedData correctly', () => {
      const mockResult = generateMockData(45);
      mockFacade.results.set(mockResult);
      component.currentPage.set(1);
      fixture.detectChanges();

      expect(component.totalItems()).toBe(45);
      expect(component.totalPages()).toBe(3);
      expect(component.startIndex()).toBe(0);
      expect(component.endIndex()).toBe(20);
      expect(component.paginatedData().length).toBe(20);
      expect(component.paginatedData()[0].subjectId).toBe('SUBJ-1');
      expect(component.paginatedData()[19].subjectId).toBe('SUBJ-20');
    });

    it('should update pagination state when Next button is clicked', () => {
      const mockResult = generateMockData(45);
      mockFacade.results.set(mockResult);
      component.currentPage.set(1);
      fixture.detectChanges();

      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const nextButton = buttons.find(b => b.nativeElement.textContent.trim() === 'Next');
      expect(nextButton).toBeTruthy();
      nextButton?.triggerEventHandler('click', null);
      fixture.detectChanges();

      expect(component.currentPage()).toBe(2);
      expect(component.startIndex()).toBe(20);
      expect(component.endIndex()).toBe(40);
      expect(component.paginatedData().length).toBe(20);
      expect(component.paginatedData()[0].subjectId).toBe('SUBJ-21');
    });

    it('should not decrement below page 1 when prevPage() is called on the first page', () => {
      const mockResult = generateMockData(45);
      mockFacade.results.set(mockResult);
      component.currentPage.set(1);
      fixture.detectChanges();

      component.prevPage();
      fixture.detectChanges();
      expect(component.currentPage()).toBe(1);
    });

    it('should not exceed the last page when nextPage() is called on the last page', () => {
      const mockResult = generateMockData(45);
      mockFacade.results.set(mockResult);
      component.currentPage.set(3);
      fixture.detectChanges();

      component.nextPage();
      fixture.detectChanges();
      expect(component.currentPage()).toBe(3);
    });

    it('should show the correct remaining items on the last page', () => {
      const mockResult = generateMockData(45);
      mockFacade.results.set(mockResult);
      component.currentPage.set(3);
      fixture.detectChanges();

      expect(component.paginatedData().length).toBe(5);
      expect(component.paginatedData()[0].subjectId).toBe('SUBJ-41');
      expect(component.paginatedData()[4].subjectId).toBe('SUBJ-45');
    });

    it('should navigate forward then backward correctly', () => {
      const mockResult = generateMockData(45);
      mockFacade.results.set(mockResult);
      component.currentPage.set(1);
      fixture.detectChanges();

      component.nextPage();
      expect(component.currentPage()).toBe(2);
      component.nextPage();
      expect(component.currentPage()).toBe(3);
      component.prevPage();
      expect(component.currentPage()).toBe(2);
    });
  });

  describe('Blinding', () => {
    it('should default to blinded and show *** BLINDED *** in DOM', () => {
      const mockResult = generateMockData(5);
      mockFacade.results.set(mockResult);
      fixture.detectChanges();

      expect(component.isUnblinded()).toBe(false);
      const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
      expect(rows.length).toBe(5);

      const firstRowCols = rows[0].queryAll(By.css('td'));
      const treatmentCol = firstRowCols[firstRowCols.length - 1];
      expect(treatmentCol.nativeElement.textContent.trim()).toBe('*** BLINDED ***');
    });

    it('should show actual treatment names when unblinded', () => {
      const mockResult = generateMockData(5);
      mockFacade.results.set(mockResult);
      fixture.detectChanges();

      component.toggleBlinding();
      fixture.detectChanges();

      expect(component.isUnblinded()).toBe(true);
      const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
      const firstRowCols = rows[0].queryAll(By.css('td'));
      const treatmentCol = firstRowCols[firstRowCols.length - 1];
      expect(treatmentCol.nativeElement.textContent.trim()).toBe('Active');
    });
  });

  describe('Export Spies', () => {
    it('should trigger exportCsv when CSV button is clicked', () => {
      const mockResult = generateMockData(5);
      mockFacade.results.set(mockResult);
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
      mockFacade.results.set(mockResult);
      fixture.detectChanges();

      const spy = vi.spyOn(component, 'exportPdf');
      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const pdfButton = buttons.find(b => b.nativeElement.textContent.trim().includes('PDF'));
      expect(pdfButton).toBeTruthy();
      pdfButton?.triggerEventHandler('click', null);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Group by Block view', () => {
    it('should default to flat view mode', () => {
      fixture.detectChanges();
      expect(component.viewMode()).toBe('flat');
    });

    it('should toggle to grouped mode when "Group by Block" button is clicked', () => {
      const mockResult = generateMockData(8);
      mockFacade.results.set(mockResult);
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
      mockFacade.results.set(mockResult);
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
      const makeSchema = (overrides: Array<Partial<{
        subjectId: string; site: string; stratum: Record<string, string>;
        stratumCode: string; blockNumber: number; blockSize: number;
        treatmentArmId: string; treatmentArm: string;
      }>>) => {
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
        mockFacade.results.set({ ...generateMockData(0), schema });
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
        mockFacade.results.set({ ...generateMockData(0), schema });
        fixture.detectChanges();

        const rows = component.groupedRows();
        // Block 1: header + 2 data rows + summary = 4
        // Block 2: header + 2 data rows + summary = 4
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
        mockFacade.results.set({ ...generateMockData(0), schema });
        fixture.detectChanges();

        const rows = component.groupedRows();
        // Two separate groups: 1 header + 1 data + 1 summary each = 6
        expect(rows.length).toBe(6);
        const headers = rows.filter(r => r.type === 'header') as any[];
        expect(headers[0].site).toBe('Site 1');
        expect(headers[1].site).toBe('Site 2');
      });

      it('summary tallies should be correct', () => {
        const schema = makeSchema([
          { subjectId: 'S1', treatmentArm: 'Active' },
          { subjectId: 'S2', treatmentArm: 'Placebo', treatmentArmId: 'a2' },
          { subjectId: 'S3', treatmentArm: 'Active' },
          { subjectId: 'S4', treatmentArm: 'Placebo', treatmentArmId: 'a2' },
        ]);
        mockFacade.results.set({ ...generateMockData(0), schema });
        fixture.detectChanges();

        const rows = component.groupedRows();
        const summary = rows[rows.length - 1] as any;
        expect(summary.type).toBe('summary');
        expect(summary.tallies['Active']).toBe(2);
        expect(summary.tallies['Placebo']).toBe(2);
        expect(summary.totalSubjects).toBe(4);
        expect(summary.isIncomplete).toBe(false);
      });

      it('should flag incomplete blocks when totalSubjects < blockSize', () => {
        const schema = makeSchema([
          { subjectId: 'S1', blockSize: 4, treatmentArm: 'Active' },
          { subjectId: 'S2', blockSize: 4, treatmentArm: 'Placebo', treatmentArmId: 'a2' },
          // only 2 of 4 subjects enrolled
        ]);
        mockFacade.results.set({ ...generateMockData(0), schema });
        fixture.detectChanges();

        const rows = component.groupedRows();
        const summary = rows[rows.length - 1] as any;
        expect(summary.isIncomplete).toBe(true);
        expect(summary.totalSubjects).toBe(2);
        expect(summary.blockSize).toBe(4);
      });
    });

    describe('getSummaryBalanceText', () => {
      it('should format tallies correctly', () => {
        expect(component.getSummaryBalanceText({ Active: 2, Placebo: 2 })).toBe('2 Active, 2 Placebo');
        expect(component.getSummaryBalanceText({ Active: 3 })).toBe('3 Active');
      });
    });

    describe('columnCount', () => {
      it('should count 4 fixed columns plus strata columns', () => {
        const data = generateMockData(1); // has 1 stratum ('site')
        mockFacade.results.set(data);
        fixture.detectChanges();
        // 4 fixed (Subject ID, Site, Block, Treatment Arm) + 1 stratum = 5
        expect(component.columnCount()).toBe(5);
      });

      it('should return 4 when no strata are defined', () => {
        const data = generateMockData(1);
        data.metadata.strata = [];
        mockFacade.results.set(data);
        fixture.detectChanges();
        expect(component.columnCount()).toBe(4);
      });
    });

    describe('grouped view DOM rendering', () => {
      it('should render header and summary rows in grouped mode (blinded)', () => {
        const mockResult = generateMockData(4); // 4 subjects, all block 1
        // Ensure all in same block
        mockResult.schema.forEach(r => { r.blockNumber = 1; r.stratumCode = 'SC1'; r.site = 'Site 1'; r.stratum = { site: 'Site 1' }; });
        mockFacade.results.set(mockResult);
        component.viewMode.set('grouped');
        fixture.detectChanges();

        const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
        // 1 header + 4 data + 1 summary = 6
        expect(rows.length).toBe(6);

        // Summary row should show blinded text
        const summaryRow = rows[rows.length - 1];
        expect(summaryRow.nativeElement.textContent).toContain('Subjects (Blinded)');
      });

      it('should render unblinded tallies in summary row when unblinded', () => {
        const mockResult = generateMockData(4);
        mockResult.schema.forEach(r => { r.blockNumber = 1; r.stratumCode = 'SC1'; r.site = 'Site 1'; r.stratum = { site: 'Site 1' }; });
        mockFacade.results.set(mockResult);
        component.viewMode.set('grouped');
        component.toggleBlinding();
        fixture.detectChanges();

        const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
        const summaryRow = rows[rows.length - 1];
        expect(summaryRow.nativeElement.textContent).toContain('Balance:');
        expect(summaryRow.nativeElement.textContent).not.toContain('Blinded');
      });

      it('should show an incomplete block warning when block has fewer subjects than blockSize', () => {
        const mockResult = generateMockData(2); // only 2 subjects but blockSize is 4
        mockResult.schema.forEach(r => { r.blockNumber = 1; r.stratumCode = 'SC1'; r.site = 'Site 1'; r.stratum = { site: 'Site 1' }; });
        mockFacade.results.set(mockResult);
        component.viewMode.set('grouped');
        fixture.detectChanges();

        const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
        const summaryRow = rows[rows.length - 1];
        expect(summaryRow.nativeElement.textContent).toContain('Incomplete Block');
      });

      it('should not show pagination controls in grouped mode', () => {
        const mockResult = generateMockData(25);
        mockFacade.results.set(mockResult);
        component.viewMode.set('grouped');
        fixture.detectChanges();

        const buttons = fixture.debugElement.queryAll(By.css('button'));
        const prevBtn = buttons.find(b => b.nativeElement.textContent.trim() === 'Previous');
        const nextBtn = buttons.find(b => b.nativeElement.textContent.trim() === 'Next');
        expect(prevBtn).toBeFalsy();
        expect(nextBtn).toBeFalsy();
      });

      it('should show pagination controls in flat mode', () => {
        const mockResult = generateMockData(25);
        mockFacade.results.set(mockResult);
        component.viewMode.set('flat');
        fixture.detectChanges();

        const buttons = fixture.debugElement.queryAll(By.css('button'));
        const prevBtn = buttons.find(b => b.nativeElement.textContent.trim() === 'Previous');
        const nextBtn = buttons.find(b => b.nativeElement.textContent.trim() === 'Next');
        expect(prevBtn).toBeTruthy();
        expect(nextBtn).toBeTruthy();
      });
    });
  });
});
