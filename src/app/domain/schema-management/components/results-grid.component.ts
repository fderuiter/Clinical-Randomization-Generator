import { Component, computed, effect, signal, inject } from '@angular/core';
import { CdkMenuModule } from '@angular/cdk/menu';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { SchemaViewStateService } from '../services/schema-view-state.service';
import { GeneratedSchema } from '../../core/models/randomization.model';
import { ViewportService } from '../../../core/services/viewport.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_VERSION } from '../../../../environments/version';

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
  imports: [CdkMenuModule],
  templateUrl: './results-grid.component.html',
  styles: [`
    .dot { transition: transform 0.2s ease-in-out; }
  `]
})
export class ResultsGridComponent {
  public state = inject(RandomizationEngineFacade);
  public viewState = inject(SchemaViewStateService);
  public readonly viewport = inject(ViewportService);

  /**
   * Tracks the row whose kebab menu is currently open so the shared menu
   * template can reference the correct data payload.
   */
  activeMenuRow = signal<GeneratedSchema | null>(null);

  /**
   * Expose the shared `isUnblinded` signal directly so existing template
   * bindings and unit-test assertions (component.isUnblinded()) still work.
   */
  get isUnblinded() { return this.viewState.isUnblinded; }

  /** Toggle between flat (paginated) view and grouped-by-block view. */
  viewMode = signal<'flat' | 'grouped'>('flat');

  currentPage = signal(1);
  pageSize = 20;

  /**
   * Total items and pagination are derived from the *filtered* dataset so
   * that applying a chart cross-filter automatically collapses the page count.
   */
  totalItems = computed(() => this.viewState.filteredCount());
  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize));

  startIndex = computed(() => (this.currentPage() - 1) * this.pageSize);
  endIndex = computed(() => Math.min(this.startIndex() + this.pageSize, this.totalItems()));

  paginatedData = computed(() => {
    const data = this.viewState.filteredSchema();
    return data.slice(this.startIndex(), this.endIndex());
  });

  /** Number of visible table columns (used for colspan in grouped view). */
  columnCount = computed(() => {
    /** Fixed columns: Subject ID, Site, Block (hidden for minimization), Treatment Arm, Actions. */
    const data = this.state.results();
    const isMinimization = data?.metadata.config?.randomizationMethod === 'MINIMIZATION';
    const BASE_COLUMNS = isMinimization ? 3 : 5; // No Block Number / Block Size for minimization
    return BASE_COLUMNS + (data?.metadata.strata?.length || 0);
  });

  /** True when the current results were generated via Pocock-Simon minimization. */
  isMinimization = computed(() =>
    this.state.results()?.metadata.config?.randomizationMethod === 'MINIMIZATION'
  );

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

    // Reset to page 1 when a cross-filter is applied (non-null) so the user
    // always starts at the first page of the filtered subset.
    // We do NOT reset when the filter is cleared (null) to avoid interfering
    // with test setups that set currentPage before detectChanges runs.
    effect(() => {
      const filter = this.viewState.activeFilter();
      if (filter !== null) {
        this.currentPage.set(1);
      }
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

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  /**
   * Splits a Subject ID string by hyphens so the template can render
   * each alphanumeric chunk with primary visual weight and the separators
   * with a demoted (gray) weight.
   */
  splitSubjectId(id: string): string[] {
    return id ? id.split('-') : [];
  }

  exportCsv() {
    const data = this.state.results();
    if (!data) return;

    const isMinimization = data.metadata.config?.randomizationMethod === 'MINIMIZATION';
    const strataHeaders = data.metadata.strata?.map(s => s.name || s.id) || [];
    const blockHeaders = isMinimization ? [] : ['Block Number', 'Block Size'];
    const headers = ['Subject ID', 'Site', ...strataHeaders, ...blockHeaders, 'Treatment Arm'];

    const rows = data.schema.map(r => {
      const strataValues = data.metadata.strata?.map(s => r.stratum[s.id] || '') || [];
      const blockValues = isMinimization ? [] : [r.blockNumber.toString(), r.blockSize.toString()];
      return [
        r.subjectId,
        r.site,
        ...strataValues,
        ...blockValues,
        this.isUnblinded() ? r.treatmentArm : '*** BLINDED ***'
      ];
    });

    const methodLabel = isMinimization
      ? `Pocock-Simon Minimization (p=${data.metadata.config?.biasedCoinProbability ?? 0.8})`
      : 'Permuted Block Randomization';
    const watermark = "DRAFT SCHEMA - DO NOT USE FOR ENROLLMENT. Execute the generated R/SAS/Python script to generate the official trial schema.";
    const timestamp = new Date(data.metadata.generatedAt).toISOString();
    const csvContent = [
      `"${watermark}"`,
      `# App Version: ${APP_VERSION}`,
      `# Generated At: ${timestamp}`,
      `# PRNG Algorithm: seedrandom (Alea)`,
      `# Randomization Method: ${methodLabel}`,
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

  exportPdf() {
    const data = this.state.results();
    if (!data) return;

    const isMinimization = data.metadata.config?.randomizationMethod === 'MINIMIZATION';
    const methodLabel = isMinimization
      ? `Pocock-Simon Minimization (p=${data.metadata.config?.biasedCoinProbability ?? 0.8})`
      : 'Permuted Block Randomization';

    const doc = new jsPDF();

    doc.setFontSize(10);
    doc.setTextColor(255, 0, 0);
    doc.text('DRAFT SCHEMA - DO NOT USE FOR ENROLLMENT. Execute the generated R/SAS/Python script to generate the official trial schema.', 14, 12);

    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text('Randomization Schema Report', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Protocol: ${data.metadata.protocolId} - ${data.metadata.studyName}`, 14, 30);
    doc.text(`Phase: ${data.metadata.phase}`, 14, 36);

    const timestamp = new Date(data.metadata.generatedAt).toISOString();
    doc.text(`App Version: ${APP_VERSION}`, 14, 42);
    doc.text(`Generated At: ${timestamp}`, 14, 48);
    doc.text(`PRNG Algorithm: seedrandom (Alea)`, 14, 54);
    doc.text(`Method: ${methodLabel}`, 14, 60);
    doc.text(`Random Seed: ${data.metadata.seed}`, 14, 66);
    doc.text(`Status: ${this.isUnblinded() ? 'UNBLINDED' : 'BLINDED'}`, 14, 72);

    const strataHeaders = data.metadata.strata?.map(s => s.name || s.id) || [];
    const blockHeaders = isMinimization ? [] : ['Block'];
    const headers = [['Subject ID', 'Site', ...strataHeaders, ...blockHeaders, 'Treatment Arm']];

    const rows = data.schema.map(r => {
      const strataValues = data.metadata.strata?.map(s => r.stratum[s.id] || '') || [];
      const blockValues = isMinimization ? [] : [`${r.blockNumber} (n=${r.blockSize})`];
      return [
        r.subjectId,
        r.site,
        ...strataValues,
        ...blockValues,
        this.isUnblinded() ? r.treatmentArm : '*** BLINDED ***'
      ];
    });

    autoTable(doc, {
      startY: 78,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    doc.save(`randomization_${data.metadata.protocolId}_${this.isUnblinded() ? 'unblinded' : 'blinded'}.pdf`);
  }
}
