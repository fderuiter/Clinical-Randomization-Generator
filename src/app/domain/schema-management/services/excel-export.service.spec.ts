/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { ExcelExportService } from './excel-export.service';
import { RandomizationResult } from '../../core/models/randomization.model';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mock state – vi.hoisted ensures initialisation runs before vi.mock
// factories are evaluated (vi.mock calls are hoisted to the top of the file).
// ---------------------------------------------------------------------------

const mockState = vi.hoisted(() => ({
  workbooks: [] as {
    creator: string;
    created: Date;
    _sheets: ReturnType<typeof createMockSheet>[];
    addWorksheet: ReturnType<typeof vi.fn>;
    xlsx: { writeBuffer: ReturnType<typeof vi.fn> };
  }[],
}));

// ---------------------------------------------------------------------------
// Mock cell / row / sheet factories (defined at module scope so both the
// vi.mock factory AND the test assertions can reference them).
// ---------------------------------------------------------------------------

function createMockCell() {
  return {
    value: undefined as unknown,
    numFmt: undefined as string | undefined,
    font: undefined as unknown,
    fill: undefined as unknown,
    alignment: undefined as unknown,
  };
}

function createMockRow() {
  const cells: Record<number, ReturnType<typeof createMockCell>> = {};
  return {
    getCell: (idx: number) => {
      if (!cells[idx]) cells[idx] = createMockCell();
      return cells[idx];
    },
    font: undefined as unknown,
    fill: undefined as unknown,
    alignment: undefined as unknown,
    height: undefined as unknown,
    _cells: cells,
  };
}

function createMockSheet(name: string) {
  const namedRows: Record<number, ReturnType<typeof createMockRow>> = {};
  const dataRows: ReturnType<typeof createMockRow>[] = [];
  return {
    name,
    columns: [] as unknown[],
    views: [] as unknown[],
    autoFilter: undefined as unknown,
    _namedRows: namedRows,
    _dataRows: dataRows,
    addRow: vi.fn(() => {
      const r = createMockRow();
      dataRows.push(r);
      return r;
    }),
    getRow: (idx: number) => {
      if (!namedRows[idx]) namedRows[idx] = createMockRow();
      return namedRows[idx];
    },
    getColumn: vi.fn(() => ({ width: undefined as unknown })),
    mergeCells: vi.fn(),
  };
}

vi.mock('exceljs', () => {
  const WorkbookMock = class {
    creator = '';
    created = new Date();
    _sheets: ReturnType<typeof createMockSheet>[] = [];

    addWorksheet = vi.fn((name: string) => {
      const s = createMockSheet(name);
      this._sheets.push(s);
      return s;
    });

    xlsx = {
      writeBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    };

    constructor() {
      mockState.workbooks.push(this as unknown as { creator: string } | any);
    }
  };
  return { default: { Workbook: WorkbookMock } };
});

// ---------------------------------------------------------------------------

const buildMockResult = (): RandomizationResult => ({
  metadata: {
    protocolId: 'PROTO-001',
    studyName: 'Test Study',
    phase: 'Phase II',
    seed: 'seed-abc',
    generatedAt: '2024-01-15T10:00:00.000Z',
    strata: [
      { id: 'sex', name: 'Sex', levels: ['M', 'F'] },
      { id: 'age', name: 'Age Group', levels: ['<65', '>=65'] },
    ],
    auditHash: 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233',
    config: {
      protocolId: 'PROTO-001',
      studyName: 'Test Study',
      phase: 'Phase II',
      arms: [
        { id: 'a', name: 'Active', ratio: 1 },
        { id: 'p', name: 'Placebo', ratio: 1 },
      ],
      sites: ['Site A', 'Site B'],
      blockSizes: [4],
      strata: [
        { id: 'sex', name: 'Sex', levels: ['M', 'F'] },
        { id: 'age', name: 'Age Group', levels: ['<65', '>=65'] },
      ],
      stratumCaps: [],
      seed: 'seed-abc',
      subjectIdMask: '{SITE}-{SEQ:3}',
    },
  },
  schema: [
    {
      subjectId: 'Site A-001',
      site: 'Site A',
      stratum: { sex: 'M', age: '<65' },
      stratumCode: 'MAL',
      blockNumber: 1,
      blockSize: 4,
      treatmentArm: 'Active',
      treatmentArmId: 'a',
    },
    {
      subjectId: 'Site A-002',
      site: 'Site A',
      stratum: { sex: 'F', age: '>=65' },
      stratumCode: 'FEM',
      blockNumber: 1,
      blockSize: 4,
      treatmentArm: 'Placebo',
      treatmentArmId: 'p',
    },
  ],
});

// ---------------------------------------------------------------------------

describe('ExcelExportService', () => {
  let service: ExcelExportService;

  // Spy on DOM link manipulation to avoid navigation errors in jsdom.
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockState.workbooks = [];

    TestBed.configureTestingModule({});
    service = TestBed.inject(ExcelExportService);

    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { /* no-op */ });
  });

  afterEach(() => {
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Workbook structure ───────────────────────────────────────────────────

  it('should create exactly two worksheets per export', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const workbook = mockState.workbooks[0];
    expect(workbook.addWorksheet).toHaveBeenCalledTimes(2);
  });

  it('should create the "Schema" sheet as the first worksheet', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const workbook = mockState.workbooks[0];
    expect(workbook.addWorksheet).toHaveBeenNthCalledWith(1, 'Schema');
  });

  it('should create the "Audit & Configuration" sheet as the second worksheet', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const workbook = mockState.workbooks[0];
    expect(workbook.addWorksheet).toHaveBeenNthCalledWith(2, 'Audit & Configuration');
  });

  // ── Schema sheet – cell formatting ───────────────────────────────────────

  it('should set numFmt "@" on every schema data cell to enforce Text type', async () => {
    const result = buildMockResult();
    await service.exportXlsx(result, true);
    const schemaSheet = mockState.workbooks[0]._sheets[0];
    // Base columns: subjectId, site, blockNumber, blockSize, treatmentArm (5) + one per stratum factor.
    const colCount = 5 + result.metadata.strata.length;
    for (const dataRow of schemaSheet._dataRows) {
      for (let colIdx = 1; colIdx <= colCount; colIdx++) {
        const cell = dataRow.getCell(colIdx);
        expect(cell.numFmt).toBe('@');
      }
    }
  });

  it('should write the Subject ID as a plain string value', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const schemaSheet = mockState.workbooks[0]._sheets[0];
    const firstRow = schemaSheet._dataRows[0];
    // Column 1 is Subject ID
    expect(firstRow.getCell(1).value).toBe('Site A-001');
  });

  // ── Blinding behaviour ───────────────────────────────────────────────────

  it('should show real treatment arm when isUnblinded is true', async () => {
    const result = buildMockResult();
    await service.exportXlsx(result, true);
    const schemaSheet = mockState.workbooks[0]._sheets[0];
    const firstRow = schemaSheet._dataRows[0];
    // treatmentArm is always the last column: 5 base cols + strata count
    const treatmentArmColIdx = 5 + result.metadata.strata.length;
    expect(firstRow.getCell(treatmentArmColIdx).value).toBe('Active');
  });

  it('should mask treatment arm with "*** BLINDED ***" when isUnblinded is false', async () => {
    const result = buildMockResult();
    await service.exportXlsx(result, false);
    const schemaSheet = mockState.workbooks[0]._sheets[0];
    const treatmentArmColIdx = 5 + result.metadata.strata.length;
    for (const dataRow of schemaSheet._dataRows) {
      expect(dataRow.getCell(treatmentArmColIdx).value).toBe('*** BLINDED ***');
    }
  });

  // ── Download mechanics ───────────────────────────────────────────────────

  it('should trigger a download with an .xlsx filename', async () => {
    await service.exportXlsx(buildMockResult(), true);

    expect(appendChildSpy).toHaveBeenCalled();
    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.getAttribute('download')).toMatch(/\.xlsx$/);
  });

  it('should include "unblinded" in filename when isUnblinded is true', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.getAttribute('download')).toContain('unblinded');
  });

  it('should include "blinded" in filename when isUnblinded is false', async () => {
    await service.exportXlsx(buildMockResult(), false);
    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.getAttribute('download')).toContain('blinded');
  });

  it('should include the protocol ID in the filename', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.getAttribute('download')).toContain('PROTO-001');
  });

  it('should sanitize special characters in the protocol ID for the filename', async () => {
    const result = buildMockResult();
    result.metadata.protocolId = 'PROTO/001 (test)';
    await service.exportXlsx(result, true);

    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    const filename = anchor.getAttribute('download') ?? '';
    expect(filename).not.toMatch(/[/ ()]/);
  });

  it('should defer DOM cleanup by 100ms', async () => {
    await service.exportXlsx(buildMockResult(), true);

    expect(removeChildSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(removeChildSpy).toHaveBeenCalled();
  });

  it('should revoke the object URL after 100ms', async () => {
    await service.exportXlsx(buildMockResult(), true);

    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  // ── Audit sheet – key cell values ────────────────────────────────────────
  //
  // Row layout (derived from buildAuditSheet implementation):
  //   Row  1 : watermark
  //   Row  3 : "Trial Metadata" section header
  //   Rows 4-8 : metadata rows (Protocol ID=4, Study Name=5, Phase=6,
  //              App Version=7, Generated At=8)
  //   Row 11 : "PRNG & Audit" section header  (= 4 + 5 meta rows + 2)
  //   Row 12 : PRNG Algorithm
  //   Row 13 : PRNG Seed
  //   Row 14 : SHA-256 Audit Hash
  //   Row 17 : "Randomization Methodology" header  (= 11 + 1 + 3 audit rows + 2)
  //   Row 18+: narrative paragraphs

  it('should write the DRAFT watermark text to row 1 of the audit sheet', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const auditSheet = mockState.workbooks[0]._sheets[1];
    const cell = auditSheet._namedRows[1].getCell(1);
    expect(cell.value as string).toContain('DRAFT SCHEMA');
    expect(cell.value as string).toContain('DO NOT USE FOR ENROLLMENT');
  });

  it('should write the protocol ID into the audit sheet metadata', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const auditSheet = mockState.workbooks[0]._sheets[1];
    // Protocol ID is the first metadata row (index 0) → row 4, value in column 2
    const valueCell = auditSheet._namedRows[4].getCell(2);
    expect(valueCell.value).toBe('PROTO-001');
  });

  it('should write the PRNG seed into the audit sheet', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const auditSheet = mockState.workbooks[0]._sheets[1];
    // PRNG Seed is the second audit row (index 1) → auditStartRow(11) + 1 + 1 = 13
    const seedCell = auditSheet._namedRows[13].getCell(2);
    expect(seedCell.value).toBe('seed-abc');
  });

  it('should write the SHA-256 audit hash into the audit sheet', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const auditSheet = mockState.workbooks[0]._sheets[1];
    // SHA-256 is the third audit row (index 2) → auditStartRow(11) + 1 + 2 = 14
    const hashCell = auditSheet._namedRows[14].getCell(2);
    expect(hashCell.value).toBe(
      'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233',
    );
  });

  it('should write at least one methodology narrative paragraph to the audit sheet', async () => {
    await service.exportXlsx(buildMockResult(), true);
    const auditSheet = mockState.workbooks[0]._sheets[1];
    // First narrative paragraph: methodStartRow(17) + 1 = 18
    const paraCell = auditSheet._namedRows[18].getCell(1);
    expect(typeof paraCell.value).toBe('string');
    expect((paraCell.value as string).length).toBeGreaterThan(0);
  });
});

