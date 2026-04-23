/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, computed, effect, signal, inject } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { CdkMenuModule } from '@angular/cdk/menu';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { SchemaViewStateService } from '../services/schema-view-state.service';
import { GeneratedSchema } from '../../core/models/randomization.model';
import { ViewportService } from '../../../core/services/viewport.service';
import { ToastService } from '../../../core/services/toast.service';
import { MethodologySpecificationService } from '../services/methodology-specification.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_VERSION } from '../../../../environments/version';
import { ExcelExportService } from '../services/excel-export.service';

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
  site: string;
  stratum: Record<string, string>;
  stratumLabel: string;
}

export interface DataRow {
  type: 'data';
  data: GeneratedSchema;
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

@Component({
  selector: 'app-results-grid',
  standalone: true,
  imports: [CdkMenuModule, ScrollingModule, KeyValuePipe],
  templateUrl: './results-grid.component.html',
  styles: [`
    .dot { transition: transform 0.2s ease-in-out; }
  `]
})
export class ResultsGridComponent {
  public state = inject(RandomizationEngineFacade);
  public viewState = inject(SchemaViewStateService);
  public readonly viewport = inject(ViewportService);
  private readonly toast = inject(ToastService);
  private readonly methodologySpec = inject(MethodologySpecificationService);
  private readonly excelExport = inject(ExcelExportService);

  /**
   * Tracks the row whose kebab menu is currently open so the shared menu
   * template can reference the correct data payload.
   */
  activeMenuRow = signal<GeneratedSchema | null>(null);

  /** Signals that the audit hash was just copied; drives the ✓ icon. */
  hashCopied = signal(false);

  /**
   * Expose the shared `isUnblinded` signal directly so existing template
   * bindings and unit-test assertions (component.isUnblinded()) still work.
   */
  get isUnblinded() { return this.viewState.isUnblinded; }

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
  processedData = computed<GeneratedSchema[]>(() => {
    let data = this.viewState.filteredSchema();

    // Step 2 – column-level text filters
    const filters = this.filterState();
    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;
      const lowerValue = value.toLowerCase();
      data = data.filter(row => {
        if (key === 'site') return row.site.toLowerCase().includes(lowerValue);
        if (key === 'treatmentArm') return row.treatmentArm.toLowerCase().includes(lowerValue);
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

        if (sort.column === 'subjectId') { aVal = a.subjectId; bVal = b.subjectId; }
        else if (sort.column === 'site') { aVal = a.site; bVal = b.site; }
        else if (sort.column === 'blockNumber') { aVal = a.blockNumber; bVal = b.blockNumber; }
        else if (sort.column === 'treatmentArm') { aVal = a.treatmentArm; bVal = b.treatmentArm; }
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
    /** Fixed columns: Subject ID, Site, Block, Treatment Arm, Actions. */
    const BASE_COLUMNS = 5;
    const data = this.state.results();
    return BASE_COLUMNS + (data?.metadata.strata?.length || 0);
  });

  /**
   * Flattened, heterogeneous array of BlockHeader / DataRow / BlockSummary
   * objects used to power the grouped-by-block view.
   *
   * Groups are formed by the compound key (site | stratumCode | blockNumber)
   * so that Block 1 for "Site A" and Block 1 for "Site B" are kept distinct.
   */
  groupedRows = computed<GridRow[]>(() => {
    const schema = this.viewState.filteredSchema();
    const result = this.state.results();
    const strataInfo = result?.metadata.strata || [];
    const strataNameMap = new Map(strataInfo.map(s => [s.id, s.name || s.id]));

    const rows: GridRow[] = [];

    // Use a Map to group rows and preserve insertion order.
    const groups = new Map<string, {
      header: BlockHeader;
      dataRows: GeneratedSchema[];
      blockSize: number;
    }>();

    for (const row of schema) {
      const key = `${row.site}|${row.stratumCode}|${row.blockNumber}`;

      if (!groups.has(key)) {
        const stratumLabel = Object.entries(row.stratum)
          .map(([k, v]) => `${strataNameMap.get(k) || k}: ${v}`)
          .join(' | ');

        groups.set(key, {
          header: {
            type: 'header',
            groupKey: key,
            blockNumber: row.blockNumber,
            site: row.site,
            stratum: row.stratum,
            stratumLabel,
          },
          dataRows: [],
          blockSize: row.blockSize,
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
        tallies[row.treatmentArm] = (tallies[row.treatmentArm] || 0) + 1;
      }

      rows.push({
        type: 'summary',
        blockSize: group.blockSize,
        totalSubjects: group.dataRows.length,
        tallies,
        isIncomplete: group.dataRows.length !== group.blockSize,
      });
    }

    return rows;
  });

  constructor() {
    // Keep the SchemaViewStateService in sync whenever new results arrive.
    effect(() => {
      this.viewState.syncResults(this.state.results());
    });
  }

  toggleBlinding() {
    this.viewState.toggleBlinding();
  }

  /** Opens the kebab context menu for a specific data row. */
  openRowMenu(row: GeneratedSchema): void {
    this.activeMenuRow.set(row);
  }

  /** Placeholder: marks a subject as dropped from the trial. */
  markAsDropped(row: GeneratedSchema | null): void {
    if (!row) return;
    console.info('[ResultsGrid] Mark as Dropped – Subject:', row.subjectId);
  }

  /** Placeholder: displays stratum detail for a subject. */
  viewStratumDetails(row: GeneratedSchema | null): void {
    if (!row) return;
    console.info('[ResultsGrid] View Stratum Details – Subject:', row.subjectId, 'Stratum:', row.stratum);
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

  trackBySubjectId(_index: number, row: GeneratedSchema): string {
    return row.subjectId;
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

  /** Returns true when the given column has a non-empty active filter. */
  hasActiveFilter(column: string): boolean {
    return !!(this.filterState()[column]);
  }
  /** Copies the audit hash to the clipboard and briefly shows a ✓ icon. */
  copyAuditHash(): void {
    const hash = this.state.results()?.metadata.auditHash;
    if (!hash) return;
    navigator.clipboard.writeText(hash).then(() => {
      this.hashCopied.set(true);
      setTimeout(() => this.hashCopied.set(false), 2000);
    }).catch(() => {
      // Clipboard write failed (e.g. permissions denied) – nothing to do visually
    });
  }

  exportCsv() {
    const data = this.state.results();
    if (!data) return;

    const strataHeaders = data.metadata.strata?.map(s => s.name || s.id) || [];
    const headers = ['Subject ID', 'Site', ...strataHeaders, 'Block Number', 'Block Size', 'Treatment Arm'];

    const rows = data.schema.map(r => {
      const strataValues = data.metadata.strata?.map(s => r.stratum[s.id] || '') || [];
      return [
        r.subjectId,
        r.site,
        ...strataValues,
        r.blockNumber.toString(),
        r.blockSize.toString(),
        this.isUnblinded() ? r.treatmentArm : '*** BLINDED ***'
      ];
    });

    const watermark = "DRAFT SCHEMA - DO NOT USE FOR ENROLLMENT. Execute the generated R/SAS/Python script to generate the official trial schema.";
    const timestamp = new Date(data.metadata.generatedAt).toISOString();
    const methodologyComments = this.methodologySpec.formatForCsv(
      this.methodologySpec.generateNarrative(data.metadata.config)
    );
    const csvContent = [
      `"${watermark}"`,
      `# Protocol ID: ${data.metadata.protocolId}`,
      `# Study Name: ${data.metadata.studyName}`,
      `# App Version: ${APP_VERSION}`,
      `# Generated At: ${timestamp}`,
      `# PRNG Algorithm: seedrandom (Alea)`,
      `# PRNG Seed: ${data.metadata.seed}`,
      `# SHA-256 Audit Hash: ${data.metadata.auditHash}`,
      methodologyComments,
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `randomization_${data.metadata.protocolId}_${this.isUnblinded() ? 'unblinded' : 'blinded'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async exportXlsx(): Promise<void> {
    const data = this.state.results();
    if (!data) return;
    try {
      await this.excelExport.exportXlsx(data, this.isUnblinded());
    } catch {
      this.toast.showError('Failed to generate Excel file. Please try again.');
    }
  }

  exportJson() {
    const data = this.state.results();
    if (!data) return;

    if (!this.isUnblinded()) {
      this.toast.showInfo(
        'JSON export is only available in unblinded mode. Please unblind the schema before exporting JSON.'
      );
      return;
    }

    const sanitize = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_').trim();
    const safeProtocol = sanitize(data.metadata.protocolId);
    const safeSeed = sanitize(data.metadata.seed);

    const exportPayload = {
      ...data,
      metadata: {
        ...data.metadata,
        methodologySpecification: this.methodologySpec.generateNarrative(data.metadata.config),
      }
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
    const data = this.state.results();
    if (!data) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const timestamp = new Date(data.metadata.generatedAt).toISOString();
    const auditHash = data.metadata.auditHash;
    const truncatedHash = auditHash ? `${auditHash.substring(0, 16)}…${auditHash.substring(48, 64)}` : 'N/A';

    // ── Certificate Header ──────────────────────────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('CERTIFICATE OF RANDOMIZATION GENERATION', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const statement =
      'This document certifies the algorithmic generation of the clinical randomization schema detailed ' +
      'below. The integrity of this dataset is mathematically verified by the attached cryptographic hash.';
    const splitStatement = doc.splitTextToSize(statement, pageWidth - 28);
    doc.text(splitStatement, 14, 26);

    // ── Metadata Block ─────────────────────────────────────────────────────
    const metaStartY = 26 + splitStatement.length * 5 + 4;
    const metaRows: [string, string][] = [
      ['Protocol ID', data.metadata.protocolId],
      ['Study Name', data.metadata.studyName],
      ['Phase', data.metadata.phase],
      ['App Version', APP_VERSION],
      ['PRNG Algorithm', 'seedrandom (Alea)'],
      ['PRNG Seed', data.metadata.seed],
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

    const narrative = this.methodologySpec.generateNarrative(data.metadata.config);
    const narrativeLines = doc.splitTextToSize(narrative, pageWidth - 28);
    doc.text(narrativeLines, 14, planStartY + 6);

    const planEndY = planStartY + 6 + narrativeLines.length * 4.5;

    // ── Data Table ─────────────────────────────────────────────────────────
    const tableStartY = planEndY + 6;

    const strataHeaders = data.metadata.strata?.map(s => s.name || s.id) || [];
    const headers = [['Subject ID', 'Site', ...strataHeaders, 'Block', 'Treatment Arm']];

    const rows = data.schema.map(r => {
      const strataValues = data.metadata.strata?.map(s => r.stratum[s.id] || '') || [];
      return [
        r.subjectId,
        r.site,
        ...strataValues,
        `${r.blockNumber} (n=${r.blockSize})`,
        this.isUnblinded() ? r.treatmentArm : '*** BLINDED ***'
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
          `Protocol: ${data.metadata.protocolId}  |  Page ${hookData.pageNumber} of ${pageCount}  |  Hash: ${truncatedHash}`,
          pageWidth / 2,
          footerY,
          { align: 'center' }
        );
      }
    });

    doc.save(`randomization_${data.metadata.protocolId}_${this.isUnblinded() ? 'unblinded' : 'blinded'}.pdf`);
  }
}
