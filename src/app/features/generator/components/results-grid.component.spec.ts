import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultsGridComponent } from './results-grid.component';
import { RandomizationResult } from '../../../models/randomization.model';
import { By } from '@angular/platform-browser';

// Mock jsPDF and URL.createObjectURL to prevent errors and actual file downloads
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

describe('ResultsGridComponent', () => {
  let component: ResultsGridComponent;
  let fixture: ComponentFixture<ResultsGridComponent>;

  const generateMockData = (count: number): RandomizationResult => {
    return {
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
          arms: [{id: 't1', name: 'Active', ratio: 1}],
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
    };
  };

  beforeEach(async () => {
    globalThis.URL.createObjectURL = vi.fn() as any;

    await TestBed.configureTestingModule({
      imports: [ResultsGridComponent]
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
      component.data = mockResult; // Triggers setter that sets result and resets page to 1
      fixture.detectChanges();

      expect(component.totalItems()).toBe(45);
      expect(component.totalPages()).toBe(3); // 45 / 20 = 2.25 -> 3
      expect(component.startIndex()).toBe(0);
      expect(component.endIndex()).toBe(20);
      expect(component.paginatedData().length).toBe(20);
      expect(component.paginatedData()[0].subjectId).toBe('SUBJ-1');
      expect(component.paginatedData()[19].subjectId).toBe('SUBJ-20');
    });

    it('should update pagination state when Next button is clicked', () => {
      const mockResult = generateMockData(45);
      component.data = mockResult;
      fixture.detectChanges();

      // Find "Next" button
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
  });

  describe('Blinding', () => {
    it('should default to blinded and show *** BLINDED *** in DOM', () => {
      const mockResult = generateMockData(5);
      component.data = mockResult;
      fixture.detectChanges();

      expect(component.isUnblinded()).toBe(false);

      const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
      expect(rows.length).toBe(5);

      const firstRowCols = rows[0].queryAll(By.css('td'));
      const treatmentCol = firstRowCols[firstRowCols.length - 1]; // Last column is Treatment Arm
      expect(treatmentCol.nativeElement.textContent.trim()).toBe('*** BLINDED ***');
    });

    it('should show actual treatment names when unblinded', () => {
      const mockResult = generateMockData(5);
      component.data = mockResult;
      fixture.detectChanges();

      component.toggleBlinding();
      fixture.detectChanges();

      expect(component.isUnblinded()).toBe(true);

      const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
      const firstRowCols = rows[0].queryAll(By.css('td'));
      const treatmentCol = firstRowCols[firstRowCols.length - 1];

      expect(treatmentCol.nativeElement.textContent.trim()).toBe('Active'); // As per generateMockData, SUBJ-1 has 'Active'
    });
  });

  describe('Export Spies', () => {
    it('should trigger exportCsv when CSV button is clicked', () => {
      const mockResult = generateMockData(5);
      component.data = mockResult;
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
      component.data = mockResult;
      fixture.detectChanges();

      const spy = vi.spyOn(component, 'exportPdf');

      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const pdfButton = buttons.find(b => b.nativeElement.textContent.trim().includes('PDF'));

      expect(pdfButton).toBeTruthy();
      pdfButton?.triggerEventHandler('click', null);

      expect(spy).toHaveBeenCalled();
    });
  });
});
