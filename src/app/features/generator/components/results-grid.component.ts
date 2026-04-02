import { Component, computed, signal, inject } from '@angular/core';
import { GeneratorStateService } from '../../../core/services/generator-state.service';
import { DataExportService } from '../../../core/services/data-export.service';

@Component({
  selector: 'app-results-grid',
  standalone: true,
  templateUrl: './results-grid.component.html',
  styles: [`
    .dot { transition: transform 0.2s ease-in-out; }
  `]
})
export class ResultsGridComponent {
  public state = inject(GeneratorStateService);
  private exportService = inject(DataExportService);

  isUnblinded = signal(false);
  currentPage = signal(1);
  pageSize = 20;

  totalItems = computed(() => this.state.results()?.schema.length || 0);
  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize));

  startIndex = computed(() => (this.currentPage() - 1) * this.pageSize);
  endIndex = computed(() => Math.min(this.startIndex() + this.pageSize, this.totalItems()));

  paginatedData = computed(() => {
    const data = this.state.results()?.schema || [];
    return data.slice(this.startIndex(), this.endIndex());
  });

  toggleBlinding() {
    this.isUnblinded.update(v => !v);
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
    if (data) {
      this.exportService.exportCsv(data, this.isUnblinded());
    }
  }

  exportPdf() {
    const data = this.state.results();
    if (data) {
      this.exportService.exportPdf(data, this.isUnblinded());
    }
  }
}
