import { Component, computed, effect, signal, inject } from '@angular/core';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { SchemaViewStateService } from '../services/schema-view-state.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_VERSION } from '../../../../environments/version';

@Component({
  selector: 'app-results-grid',
  standalone: true,
  templateUrl: './results-grid.component.html',
  styles: [`
    .dot { transition: transform 0.2s ease-in-out; }
  `]
})
export class ResultsGridComponent {
  public state = inject(RandomizationEngineFacade);
  public viewState = inject(SchemaViewStateService);

  /**
   * Expose the shared `isUnblinded` signal directly so existing template
   * bindings and unit-test assertions (component.isUnblinded()) still work.
   */
  get isUnblinded() { return this.viewState.isUnblinded; }

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
  const csvContent = [
    `"${watermark}"`,
    `# App Version: ${APP_VERSION}`,
    `# Generated At: ${timestamp}`,
    `# PRNG Algorithm: seedrandom (Alea)`,
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
    doc.text(`Random Seed: ${data.metadata.seed}`, 14, 60);
    doc.text(`Status: ${this.isUnblinded() ? 'UNBLINDED' : 'BLINDED'}`, 14, 66);

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
      startY: 72,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    doc.save(`randomization_${data.metadata.protocolId}_${this.isUnblinded() ? 'unblinded' : 'blinded'}.pdf`);
  }
}
