import { Injectable, inject } from '@angular/core';
import { RandomizationResult } from '../../core/models/randomization.model';
import { MethodologySpecificationService } from './methodology-specification.service';
import { APP_VERSION } from '../../../../environments/version';

/**
 * Generates a strongly-typed, two-sheet Excel (.xlsx) workbook from a
 * {@link RandomizationResult}.
 *
 * Sheet 1 – "Schema": the clean, tabular randomization grid with frozen header,
 *   auto-filters, auto-sized columns, and all cells formatted as Text
 *   (`numFmt: '@'`) to prevent spreadsheet software from mangling leading zeros
 *   or numeric identifiers.
 *
 * Sheet 2 – "Audit & Configuration": trial metadata, PRNG seed, protocol ID,
 *   generation timestamp, and the full randomization methodology narrative.
 */
@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  private readonly methodologySpec = inject(MethodologySpecificationService);

  /**
   * Builds an xlsx Blob from the provided result and unblinded flag, then
   * triggers a browser download.
   *
   * The operation is async because ExcelJS is lazy-loaded so it does not
   * contribute to the main application bundle.
   */
  async exportXlsx(result: RandomizationResult, isUnblinded: boolean): Promise<void> {
    // Lazy-load ExcelJS to keep the initial bundle lean.
    // Guard against CJS/ESM interop variation: Angular's esbuild-based builder
    // may surface the namespace at the top level rather than under `.default`.
    const mod = await import('exceljs');
    const ExcelJS = (mod.default ?? mod) as typeof import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = `Clinical Randomization Generator ${APP_VERSION}`;
    workbook.created = new Date(result.metadata.generatedAt);

    this.buildSchemaSheet(workbook, result, isUnblinded);
    this.buildAuditSheet(workbook, result);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const blindLabel = isUnblinded ? 'unblinded' : 'blinded';
    const safeProtocol = result.metadata.protocolId.replace(/[^A-Za-z0-9._-]/g, '_');
    link.setAttribute('download', `randomization_${safeProtocol}_${blindLabel}.xlsx`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // ---------------------------------------------------------------------------
  // Sheet builders
  // ---------------------------------------------------------------------------

  private buildSchemaSheet(
    workbook: import('exceljs').Workbook,
    result: RandomizationResult,
    isUnblinded: boolean,
  ): void {
    const sheet = workbook.addWorksheet('Schema');
    const strataFactors = result.metadata.strata;

    // ── Column definitions ──────────────────────────────────────────────────
    const columnKeys: string[] = [
      'subjectId',
      'site',
      ...strataFactors.map(s => `stratum_${s.id}`),
      'blockNumber',
      'blockSize',
      'treatmentArm',
    ];
    const headerLabels: string[] = [
      'Subject ID',
      'Site',
      ...strataFactors.map(s => s.name || s.id),
      'Block Number',
      'Block Size',
      'Treatment Arm',
    ];

    sheet.columns = columnKeys.map((key, i) => ({
      key,
      header: headerLabels[i],
      // Start with a reasonable minimum; will be adjusted after adding data.
      width: Math.max(12, headerLabels[i].length + 2),
    }));

    // Style the header row.
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // indigo-600
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    // Freeze the top header row.
    sheet.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', showGridLines: true }];

    // Enable auto-filters on the header row spanning all columns.
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columnKeys.length },
    };

    // ── Data rows ───────────────────────────────────────────────────────────
    // Track the maximum character width encountered per column for auto-sizing.
    const maxWidths: number[] = headerLabels.map(h => h.length);

    for (const schema of result.schema) {
      const treatmentArmValue = isUnblinded ? schema.treatmentArm : '*** BLINDED ***';

      const rowValues: Record<string, string> = {
        subjectId: schema.subjectId,
        site: schema.site,
        blockNumber: String(schema.blockNumber),
        blockSize: String(schema.blockSize),
        treatmentArm: treatmentArmValue,
      };

      for (const factor of strataFactors) {
        rowValues[`stratum_${factor.id}`] = schema.stratum[factor.id] ?? '';
      }

      const excelRow = sheet.addRow({});

      // Assign each cell individually with an explicit string value and the
      // Excel "Text" number format ('@').  Using String() values together with
      // numFmt '@' is the supported API to prevent spreadsheet software from
      // re-interpreting numeric-looking identifiers (e.g. stripping leading
      // zeros from Subject IDs).
      columnKeys.forEach((key, colIdx) => {
        const cell = excelRow.getCell(colIdx + 1);
        const val = rowValues[key] ?? '';
        cell.value = val;
        cell.numFmt = '@'; // "@" format = "Text" in Excel

        // Track max width for auto-sizing.
        if (val.length > maxWidths[colIdx]) {
          maxWidths[colIdx] = val.length;
        }
      });
    }

    // ── Auto-size columns ───────────────────────────────────────────────────
    sheet.columns.forEach((col, i) => {
      // Add a small padding buffer; cap at 60 chars to avoid excessively wide cols.
      col.width = Math.min(60, maxWidths[i] + 3);
    });
  }

  private buildAuditSheet(
    workbook: import('exceljs').Workbook,
    result: RandomizationResult,
  ): void {
    const sheet = workbook.addWorksheet('Audit & Configuration');

    // ── Helpers ─────────────────────────────────────────────────────────────
    const addSectionHeader = (label: string, rowIndex: number) => {
      const row = sheet.getRow(rowIndex);
      const cell = row.getCell(1);
      cell.value = label;
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { vertical: 'middle' };
      row.height = 20;
      sheet.mergeCells(rowIndex, 1, rowIndex, 2);
    };

    const addMetaRow = (label: string, value: string, rowIndex: number) => {
      const row = sheet.getRow(rowIndex);
      const labelCell = row.getCell(1);
      labelCell.value = label;
      labelCell.font = { bold: true };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
      const valueCell = row.getCell(2);
      valueCell.value = value;
      valueCell.numFmt = '@';
      valueCell.alignment = { wrapText: true };
    };

    // ── WATERMARK ───────────────────────────────────────────────────────────
    const watermarkRow = sheet.getRow(1);
    const watermarkCell = watermarkRow.getCell(1);
    watermarkCell.value =
      'DRAFT SCHEMA - DO NOT USE FOR ENROLLMENT. ' +
      'Execute the generated R/SAS/Python/STATA script to generate the official trial schema.';
    watermarkCell.font = { bold: true, color: { argb: 'FF991B1B' } };
    watermarkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
    watermarkCell.alignment = { wrapText: true };
    watermarkRow.height = 30;
    sheet.mergeCells(1, 1, 1, 2);

    // ── TRIAL METADATA ───────────────────────────────────────────────────────
    addSectionHeader('Trial Metadata', 3);
    const timestamp = new Date(result.metadata.generatedAt).toISOString();
    const metaRows: [string, string][] = [
      ['Protocol ID', result.metadata.protocolId],
      ['Study Name', result.metadata.studyName],
      ['Phase', result.metadata.phase],
      ['App Version', APP_VERSION],
      ['Generated At (ISO 8601)', timestamp],
    ];
    metaRows.forEach(([label, value], i) => addMetaRow(label, value, 4 + i));

    // ── PRNG / AUDIT ─────────────────────────────────────────────────────────
    const auditStartRow = 4 + metaRows.length + 2;
    addSectionHeader('PRNG & Audit', auditStartRow);
    const auditRows: [string, string][] = [
      ['PRNG Algorithm', 'seedrandom (Alea)'],
      ['PRNG Seed', result.metadata.seed],
      ['SHA-256 Audit Hash', result.metadata.auditHash],
    ];
    auditRows.forEach(([label, value], i) =>
      addMetaRow(label, value, auditStartRow + 1 + i),
    );

    // ── METHODOLOGY NARRATIVE ────────────────────────────────────────────────
    const methodStartRow = auditStartRow + 1 + auditRows.length + 2;
    addSectionHeader('Randomization Methodology', methodStartRow);
    const narrative = this.methodologySpec.generateNarrative(result.metadata.config);
    const narrativeParagraphs = narrative.split('\n\n');
    let currentRow = methodStartRow + 1;
    for (const paragraph of narrativeParagraphs) {
      const row = sheet.getRow(currentRow);
      const cell = row.getCell(1);
      cell.value = paragraph.replace(/\n/g, ' ');
      cell.alignment = { wrapText: true };
      sheet.mergeCells(currentRow, 1, currentRow, 2);
      row.height = Math.max(20, Math.ceil(paragraph.length / 100) * 15);
      currentRow++;
    }

    // ── Column widths ────────────────────────────────────────────────────────
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 80;
  }
}
