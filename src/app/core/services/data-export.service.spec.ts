import { TestBed } from '@angular/core/testing';
import { DataExportService } from './data-export.service';
import { RandomizationResult } from '../../models/randomization.model';
import jsPDF from 'jspdf';
import { vi } from 'vitest';

const mockSave = vi.fn();
vi.mock('jspdf', () => {
  return {
    default: class {
      setFontSize = vi.fn();
      text = vi.fn();
      setTextColor = vi.fn();
      save = mockSave;
    }
  };
});
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

describe('DataExportService', () => {
  let service: DataExportService;
  let mockData: RandomizationResult;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataExportService);

    mockData = {
      metadata: {
        protocolId: 'TEST-001',
        studyName: 'Mock Study',
        phase: 'Phase 1',
        seed: '12345',
        generatedAt: new Date().toISOString(),
        strata: [{ id: 'strata1', name: 'Age', levels: ['<65', '>=65'] }],
        config: {} as any
      },
      schema: [
        {
          subjectId: 'Site1-001',
          site: 'Site1',
          stratum: { strata1: '<65' },
          stratumCode: 'L',
          blockNumber: 1,
          blockSize: 2,
          treatmentArm: 'Active',
          treatmentArmId: 'A'
        }
      ]
    };
  });

  it('should trigger CSV download with blinded data', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Mock the anchor tag click
    const mockAnchor = document.createElement('a');
    const clickSpy = vi.spyOn(mockAnchor, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

    service.exportCsv(mockData, false); // isUnblinded = false

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(mockAnchor.download).toBe('randomization_TEST-001_blinded.csv');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should trigger PDF download with unblinded data', () => {
    mockSave.mockClear();

    service.exportPdf(mockData, true); // isUnblinded = true

    expect(mockSave).toHaveBeenCalledWith('randomization_TEST-001_unblinded.pdf');
  });
});
