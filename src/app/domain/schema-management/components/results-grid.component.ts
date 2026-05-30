/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, computed, effect, signal, inject, ChangeDetectionStrategy, DestroyRef, QueryList, ViewChildren } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { CdkMenuModule, CdkMenuTrigger } from '@angular/cdk/menu';
import { ScrollDispatcher, ScrollingModule } from '@angular/cdk/scrolling';
import { BIOSTAT_DATA_ADAPTER } from '../adapters/biostat-data-adapter';
import { TrialRecord } from '../adapters/trial-record.model';
import { ViewportService } from '../../../core/services/viewport.service';
import { ToastService } from '../../../core/services/toast.service';
import { MethodologySpecificationService } from '../services/methodology-specification.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_VERSION } from '../../../../environments/version';
import { ExcelExportService } from '../services/excel-export.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type SortDirection = 'asc' | 'desc' | 'none';

export interface SortState {
  column: string;
  direction: SortDirection;
}

// ---------------------------------------------------------------------------
// Grouped-view row types
// ---------------------------------------------------------------------------

export interface BlockHeader {
  type: 'header';
  groupKey: string;
  blockNumber: number;
  groupingFactor: string;
  stratum: Record<string, string>;
  stratumLabel: string;
}

export interface DataRow {
  type: 'data';
  data: TrialRecord;
}

export interface BlockSummary {
  type: 'summary';
  blockSize: number;
  totalSubjects: number;
  tallies: Record<string, number>;
  isIncomplete: boolean;
}

export type GridRow = BlockHeader | DataRow | BlockSummary;

// ---------------------------------------------------------------------------

/**
 * ⚡ Bolt Performance Optimization:
 * Added ChangeDetectionStrategy.OnPush to minimize unnecessary re-renders.
 */
@Component({
  selector: 'app-results-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkMenuModule, ScrollingModule, KeyValuePipe],
  templateUrl: './results-grid.component.html',
  styles: [`
    .dot { transition: transform 0.2s ease-in-out; }
  `]
})
export class ResultsGridComponent {
  public adapter = inject(BIOSTAT_DATA_ADAPTER);
  public readonly viewport = inject(ViewportService);
  private readonly toast = inject(ToastService);
  private readonly methodologySpec = inject(MethodologySpecificationService);
  private readonly excelExport = inject(ExcelExportService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scrollDispatcher = inject(ScrollDispatcher);

  @ViewChildren(CdkMenuTrigger) private menuTriggers?: QueryList<CdkMenuTrigger>;

  /**
   * Tracks the row whose kebab menu is currently open so the shared menu
   * template can reference the correct data payload.
   */
  activeMenuRow = signal<TrialRecord | null>(null);

  /** Signals that the audit hash was just copied; drives the ✓ icon. */
  hashCopied = signal(false);

  /**
   * Expose the shared `isUnblinded` signal directly so existing template
   * bindings and unit-test assertions (component.isUnblinded()) still work.
   */
  get isUnblinded() { return this.adapter.isUnblinded; }

  /** Toggle between flat (virtual-scroll) view and grouped-by-block view. */
  viewMode = signal<'flat' | 'grouped'>('flat');

  // ── Multi-column sort / filter state ────────────────────────────────────

  /** Active sort column and direction. */
  sortState = signal<SortState>({ column: '', direction: 'none' });

  /** Map of column key → active filter string. */
  filterState = signal<Record<string, string>>({});

  /** Which column's filter dropdown is currently open. */
  activeFilterColumn = signal<string | null>(null);

  /**
   * Reactive data pipeline for the flat view:
   * 1. Start from the cross-filtered schema (chart clicks / service-level filter).
   * 2. Apply any per-column text filters from `filterState`.
   * 3. Apply the active sort from `sortState`.
   */
  processedData = computed<TrialRecord[]>(() => {
    let data = this.adapter.filteredRecords();

    // Step 2 – column-level text filters
    const filters = this.filterState();
    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;
      const lowerValue = value.toLowerCase();
      data = data.filter(row => {
        if (key === 'groupingFactor') return row.groupingFactor.toLowerCase().includes(lowerValue);
        if (key === 'category') return row.category.toLowerCase().includes(lowerValue);
        if (key === 'id') return row.id.toLowerCase().includes(lowerValue);
        if (key.startsWith('stratum_')) {
          const stratumId = key.replace('stratum_', '');
          return (row.stratum[stratumId] || '').toLowerCase().includes(lowerValue);
        }
        return true;
      });
    }

    // Step 3 – sorting
    const sort = this.sortState();
    if (sort.direction !== 'none' && sort.column) {
      data = [...data].sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';

        if (sort.column === 'id') { aVal = a.id; bVal = b.id; }
        else if (sort.column === 'groupingFactor') { aVal = a.groupingFactor; bVal = b.groupingFactor; }
        else if (sort.column === 'blockNumber') { aVal = a.blockNumber ?? 0; bVal = b.blockNumber ?? 0; }
        else if (sort.column === 'category') { aVal = a.category; bVal = b.category; }
        else if (sort.column.startsWith('stratum_')) {
          const stratumId = sort.column.replace('stratum_', '');
          aVal = a.stratum[stratumId] || '';
          bVal = b.stratum[stratumId] || '';
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sort.direction === 'asc' ? cmp : -cmp;
      });
    }

    return data;
  });

  /** Number of visible table columns (used for colspan in grouped view). */
  columnCount = computed(() => {
    /** Fixed columns: Record ID, Grouping Factor, Block, Category, Actions. */
    const BASE_COLUMNS = 5;
    const factors = this.adapter.factors();
    return BASE_COLUMNS + factors.length;
  });

  /**
   * Flattened, heterogeneous array of BlockHeader / DataRow / BlockSummary
   * objects used to power the grouped-by-block view.
   *
   * Groups are formed by the compound key (groupingFactor | stratumCode | blockNumber)
   * so that Block 1 for "Group A" and Block 1 for "Group B" are kept distinct.
   */
  groupedRows = computed<GridRow[]>(() => {
    const records = this.adapter.filteredRecords();
    const factorsInfo = this.adapter.factors();
    const strataNameMap = new Map(factorsInfo.map(s => [s.id, s.name || s.id]));

    const rows: GridRow[] = [];

    // Use a Map to group rows and preserve insertion order.
    const groups = new Map<string, {
      header: BlockHeader;
      dataRows: TrialRecord[];
      blockSize: number;
    }>();

    for (const row of records) {
      const blockNumber = row.blockNumber ?? 0;
      const stratumCode = row['stratumCode'] ?? '';
      const key = `${row.groupingFactor}|${stratumCode}|${blockNumber}`;

      if (!groups.has(key)) {
        const stratumLabel = Object.entries(row.stratum)
          .map(([k, v]) => `${strataNameMap.get(k) || k}: ${v}`)
          .join(' | ');

        groups.set(key, {
          header: {
            type: 'header',
            groupKey: key,
            blockNumber,
            groupingFactor: row.groupingFactor,
            stratum: row.stratum,
            stratumLabel,
          },
          dataRows: [],
          blockSize: row.blockSize ?? 0,
        });
      }

      groups.get(key)!.dataRows.push(row);
    }

    for (const [, group] of groups) {
      rows.push(group.header);

      for (const row of group.dataRows) {
        rows.push({ type: 'data', data: row });
      }

      const tallies: Record<string, number> = {};
      for (const row of group.dataRows) {
        tallies[row.category] = (tallies[row.category] || 0) + 1;
      }

      rows.push({
        type: 'summary',
        blockSize: group.blockSize,
        totalSubjects: group.dataRows.length,
        tallies,
        isIncomplete: group.blockSize > 0 && group.dataRows.length !== group.blockSize,
      });
    }

    return rows;
  });

  constructor() {
    this.scrollDispatcher
      .scrolled()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.closeOpenMenus());
  }

  toggleBlinding() {
    this.adapter.toggleBlinding();
  }

  /** Opens the kebab context menu for a specific data row. */
  openRowMenu(row: TrialRecord): void {
    this.activeMenuRow.set(row);
  }

  /** Placeholder: marks a subject as dropped from the trial. */
  markAsDropped(row: TrialRecord | null): void {
    if (!row) return;
    console.info('[ResultsGrid] Mark as Dropped – Subject:', row.id);
  }

  /** Placeholder: displays stratum detail for a subject. */
  viewStratumDetails(row: TrialRecord | null): void {
    if (!row) return;
    console.info('[ResultsGrid] View Stratum Details – Subject:', row.id, 'Stratum:', row.stratum);
  }

  /**
   * Formats treatment-arm tallies for the unblinded summary row.
   * e.g. { Active: 2, Placebo: 2 } → "2 Active, 2 Placebo"
   */
  getSummaryBalanceText(tallies: Record<string, number>): string {
    return Object.entries(tallies)
      .map(([arm, count]) => `${count} ${arm}`)
      .join(', ');
  }

  /**
   * Splits a Subject ID string by hyphens so the template can render
   * each alphanumeric chunk with primary visual weight and the separators
   * with a demoted (gray) weight.
   */
  splitSubjectId(id: string): string[] {
    return id ? id.split('-') : [];
  }

  // ── Virtual-scroll trackBy ───────────────────────────────────────────────

  trackBySubjectId(_index: number, row: TrialRecord): string {
    return row.id;
  }

  // ── Sort / Filter helpers ────────────────────────────────────────────────

  /**
   * Cycles the sort direction for a column: none → asc → desc → none.
   * Switching to a different column always resets to 'asc'.
   */
  toggleSort(column: string): void {
    this.sortState.update(current => {
      if (current.column !== column) return { column, direction: 'asc' };
      if (current.direction === 'asc') return { column, direction: 'desc' };
      if (current.direction === 'desc') return { column: '', direction: 'none' };
      return { column, direction: 'asc' };
    });
  }

  /** Records which column's filter panel is currently active. */
  openColumnFilter(column: string): void {
    this.activeFilterColumn.set(column);
  }

  /** Updates the filter value for `activeFilterColumn`. */
  updateColumnFilter(value: string): void {
    const column = this.activeFilterColumn();
    if (!column) return;
    this.filterState.update(state => ({ ...state, [column]: value }));
  }

  /** Removes the filter for the given column. */
  clearColumnFilter(column: string): void {
    this.filterState.update(state => {
      const next = { ...state };
      delete next[column];
      return next;
    });
  }

  /** Clears all active column filters at once. */
  clearAllFilters(): void {
    this.filterState.set({});
  }

  /** Closes any currently-open CDK menus. */
  closeOpenMenus(): void {
    this.menuTriggers?.forEach(trigger => trigger.close());
  }

  /** Middle-truncated display value for the audit hash banner. */
  get truncatedAuditHash(): string {
    const hash = this.adapter.metadata()?.auditHash ?? '';
    return hash.length > 24 ? `${hash.substring(0, 12)}...${hash.substring(hash.length - 12)}` : hash;
  }

  /** Returns true when the given column has a non-empty active filter. */
  hasActiveFilter(column: string): boolean {
    return !!(this.filterState()[column]);
  }

  /** Sanitizes a string for use in filenames by replacing invalid characters with underscores. */
  private sanitizeFilename(s: string): string {
    return s.replace(/[^A-Za-z0-9._-]/g, '_').trim();
  }

  /** Returns today's date as a compact `YYYYMMDD` string for use in export filenames. */
  private formatDateStamp(date = new Date()): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  /**
   * Sanitizes a value for CSV export to prevent Formula Injection (CSV Injection).
   * It escapes double quotes, wraps the value in double quotes, and prepends a single
   * quote if the value starts with an executable prefix.
   */
  private sanitizeCsvValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return '""';
    }
    const strValue = String(value);
    const escapedValue = strValue.replace(/"/g, '""');

    // Check for formula injection prefixes
    if (/^[=+\-@\t\r]/.test(escapedValue)) {
      return `"'${escapedValue}"`;
    }

    return `"${escapedValue}"`;
  }

  /** Copies the audit hash to the clipboard and briefly shows a ✓ icon. */
  copyAuditHash(): void {
    const hash = this.adapter.metadata()?.auditHash;
    if (!hash) return;
    navigator.clipboard.writeText(hash).then(() => {
      this.hashCopied.set(true);
      setTimeout(() => this.hashCopied.set(false), 2000);
    }).catch(() => {
      // Clipboard write failed (e.g. permissions denied) – nothing to do visually
    });
  }

  exportCsv() {
    const records = this.adapter.records();
    const metadata = this.adapter.metadata();
    if (!records.length || !metadata) return;

    const strataHeaders = metadata.strata?.map((s: any) => s.name || s.id) || [];
    const headers = ['Subject ID', 'Site', ...strataHeaders, 'Block Number', 'Block Size', 'Treatment Arm']
      .map(h => this.sanitizeCsvValue(h));

    const rows = records.map(r => {
      const strataValues = metadata.strata?.map((s: any) => r.stratum[s.id] || '') || [];
      return [
        r.id,
        r.groupingFactor,
        ...strataValues,
        r.blockNumber?.toString() ?? '',
        r.blockSize?.toString() ?? '',
        this.isUnblinded() ? r.category : '*** BLINDED ***'
      ].map(val => this.sanitizeCsvValue(val));
    });

    const watermark = "DRAFT SCHEMA - DO NOT USE FOR ENROLLMENT. Execute the generated R/SAS/Python script to generate the official trial schema for RTSM/IRT implementation.";
    const timestamp = new Date(metadata.generatedAt).toISOString();
    const methodologyComments = this.methodologySpec.formatForCsv(
      this.methodologySpec.generateNarrative(metadata.config)
    );
    const csvContent = [
      `"${watermark}"`,
      `# Protocol ID: ${metadata.protocolId}`,
      `# Study Name: ${metadata.studyName}`,
      `# App Version: ${APP_VERSION}`,
      `# Generated At: ${timestamp}`,
      `# PRNG Algorithm: Mersenne Twister (MT19937)`,
      `# PRNG Seed: ${metadata.seed}`,
      `# SHA-256 Audit Hash: ${metadata.auditHash}`,
      methodologyComments,
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const safeProtocol = this.sanitizeFilename(metadata.protocolId);
    const dateStamp = this.formatDateStamp();
    link.setAttribute('href', url);
    link.setAttribute('download', `randomization_${dateStamp}_${safeProtocol}_${this.isUnblinded() ? 'unblinded' : 'blinded'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }

  async exportXlsx(): Promise<void> {
    const records = this.adapter.records();
    const metadata = this.adapter.metadata();
    if (!records.length || !metadata) return;
    
    // We map back to RandomizationResult format since ExcelExportService expects it
    const fakeResult: any = {
      metadata,
      schema: records.map(r => ({
        subjectId: r.id,
        site: r.groupingFactor,
        treatmentArm: r.category,
        stratum: r.stratum,
        ...r
      }))
    };

    try {
      await this.excelExport.exportXlsx(fakeResult, this.isUnblinded());
    } catch {
      this.toast.showError('Failed to generate Excel file. Please try again.');
    }
  }

  exportJson() {
    const records = this.adapter.records();
    const metadata = this.adapter.metadata();
    if (!records.length || !metadata) return;

    if (!this.isUnblinded()) {
      this.toast.showInfo(
        'JSON export is only available in unblinded mode. Please unblind the schema before exporting JSON.'
      );
      return;
    }

    const safeProtocol = this.sanitizeFilename(metadata.protocolId);
    const safeSeed = this.sanitizeFilename(metadata.seed);

    const exportPayload = {
      metadata: {
        ...metadata,
        methodologySpecification: this.methodologySpec.generateNarrative(metadata.config),
      },
      schema: records.map(r => ({
        subjectId: r.id,
        site: r.groupingFactor,
        treatmentArm: r.category,
        stratum: r.stratum,
        ...r
      }))
    };

    const json = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `randomization_${safeProtocol}_${safeSeed}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }

  exportPdf() {
    const records = this.adapter.records();
    const metadata = this.adapter.metadata();
    if (!records.length || !metadata) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const timestamp = new Date(metadata.generatedAt).toISOString();
    const auditHash = metadata.auditHash;
    const truncatedHash = auditHash ? `${auditHash.substring(0, 16)}…${auditHash.substring(48, 64)}` : 'N/A';

    // ── Certificate Header ──────────────────────────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('RTSM/IRT RANDOMIZATION GENERATION CERTIFICATE', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const statement =
      'This document certifies the algorithmic generation of the RTSM/IRT randomization schema detailed ' +
      'below. The integrity of this dataset is mathematically verified by the attached cryptographic hash.';
    const splitStatement = doc.splitTextToSize(statement, pageWidth - 28);
    doc.text(splitStatement, 14, 26);

    // ── Metadata Block ─────────────────────────────────────────────────────
    const metaStartY = 26 + splitStatement.length * 5 + 4;
    const metaRows: [string, string][] = [
      ['Protocol ID', metadata.protocolId],
      ['Study Name', metadata.studyName],
      ['Phase', metadata.phase],
      ['App Version', APP_VERSION],
      ['PRNG Algorithm', 'Mersenne Twister (MT19937)'],
      ['PRNG Seed', metadata.seed],
      ['Generated At (ISO 8601)', timestamp],
      ['SHA-256 Audit Hash', auditHash],
    ];

    autoTable(doc, {
      startY: metaStartY,
      head: [['Field', 'Value']],
      body: metaRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { cellWidth: 'auto', font: 'courier' } },
      didParseCell: (hookData) => {
        // Highlight the SHA-256 row
        if (hookData.row.index === metaRows.length - 1 && hookData.section === 'body') {
          hookData.cell.styles.fillColor = [235, 232, 255];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // ── Randomization Plan & Specifications ────────────────────────────────
    const planStartY = (doc as any).lastAutoTable?.finalY + 8 || metaStartY + 60;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Randomization Plan & Specifications', 14, planStartY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    const narrative = this.methodologySpec.generateNarrative(metadata.config);
    const narrativeLines = doc.splitTextToSize(narrative, pageWidth - 28);
    doc.text(narrativeLines, 14, planStartY + 6);

    const planEndY = planStartY + 6 + narrativeLines.length * 4.5;

    // ── Data Table ─────────────────────────────────────────────────────────
    const tableStartY = planEndY + 6;

    const strataHeaders = metadata.strata?.map((s: any) => s.name || s.id) || [];
    const headers = [['Subject ID', 'Site', ...strataHeaders, 'Block', 'Treatment Arm']];

    const rows = records.map(r => {
      const strataValues = metadata.strata?.map((s: any) => r.stratum[s.id] || '') || [];
      return [
        r.id,
        r.groupingFactor,
        ...strataValues,
        `${r.blockNumber ?? ''} (n=${r.blockSize ?? ''})`,
        this.isUnblinded() ? r.category : '*** BLINDED ***'
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9, cellPadding: 3 },
      // Footer on every page
      didDrawPage: (hookData) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        const footerY = doc.internal.pageSize.getHeight() - 8;
        doc.setFontSize(7);
        doc.setTextColor(130);
        doc.text(
          `Protocol: ${metadata.protocolId}  |  Page ${hookData.pageNumber} of ${pageCount}  |  Hash: ${truncatedHash}`,
          pageWidth / 2,
          footerY,
          { align: 'center' }
        );
      }
    });

    const safeProtocol = this.sanitizeFilename(metadata.protocolId);
    doc.save(`randomization_${safeProtocol}_${this.isUnblinded() ? 'unblinded' : 'blinded'}.pdf`);
  }
}
