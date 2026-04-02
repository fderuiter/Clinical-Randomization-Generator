import { Component, Input, computed, signal } from '@angular/core';
import { RandomizationResult } from './randomization.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_VERSION } from '../environments/version';

@Component({
  selector: 'app-results-grid',
  standalone: true,
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900">Generated Schema</h2>
          <p class="text-sm text-gray-500 mt-1">
            Protocol: {{result()?.metadata?.protocolId}} | Seed: <span class="font-mono bg-gray-100 px-1 rounded">{{result()?.metadata?.seed}}</span>
          </p>
        </div>
        
        <div class="flex items-center gap-3">
          <label class="flex items-center cursor-pointer">
            <div class="relative">
              <input type="checkbox" class="sr-only" [checked]="isUnblinded()" (change)="toggleBlinding()">
              <div class="block bg-gray-200 w-10 h-6 rounded-full transition-colors" [class.bg-indigo-500]="isUnblinded()"></div>
              <div class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform" [class.translate-x-4]="isUnblinded()"></div>
            </div>
            <span class="ml-3 text-sm font-medium text-gray-700">
              {{ isUnblinded() ? 'Unblinded' : 'Blinded' }}
            </span>
          </label>
          
          <div class="h-6 w-px bg-gray-300 mx-1"></div>
          
          <button (click)="exportCsv()" class="text-sm bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50 font-medium transition-colors flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
          <button (click)="exportPdf()" class="text-sm bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50 font-medium transition-colors flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF
          </button>
        </div>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject ID</th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Site</th>
              @for (stratum of result()?.metadata?.strata; track stratum.id) {
                <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{{stratum.name || stratum.id}}</th>
              }
              <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Block</th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Treatment Arm</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            @for (row of paginatedData(); track row.subjectId) {
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">{{row.subjectId}}</td>
                <td class="px-6 py-5 whitespace-nowrap text-sm text-gray-600">{{row.site}}</td>
                @for (stratum of result()?.metadata?.strata; track stratum.id) {
                  <td class="px-6 py-5 whitespace-nowrap text-sm text-gray-600">{{row.stratum[stratum.id]}}</td>
                }
                <td class="px-6 py-5 whitespace-nowrap text-sm text-gray-600">{{row.blockNumber}} (Size: {{row.blockSize}})</td>
                <td class="px-6 py-5 whitespace-nowrap text-sm">
                  @if (isUnblinded()) {
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {{row.treatmentArm}}
                    </span>
                  } @else {
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      *** BLINDED ***
                    </span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div class="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
        <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700">
              Showing <span class="font-medium">{{startIndex() + 1}}</span> to <span class="font-medium">{{endIndex()}}</span> of <span class="font-medium">{{totalItems()}}</span> results
            </p>
          </div>
          <div>
            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button (click)="prevPage()" [disabled]="currentPage() === 1" class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                Previous
              </button>
              <button (click)="nextPage()" [disabled]="currentPage() === totalPages()" class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                Next
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dot { transition: transform 0.2s ease-in-out; }
  `]
})
export class ResultsGridComponent {
  result = signal<RandomizationResult | null>(null);
  
  @Input() set data(val: RandomizationResult | null) {
    this.result.set(val);
    this.currentPage.set(1);
  }

  isUnblinded = signal(false);
  currentPage = signal(1);
  pageSize = 20;

  totalItems = computed(() => this.result()?.schema.length || 0);
  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize));
  
  startIndex = computed(() => (this.currentPage() - 1) * this.pageSize);
  endIndex = computed(() => Math.min(this.startIndex() + this.pageSize, this.totalItems()));
  
  paginatedData = computed(() => {
    const data = this.result()?.schema || [];
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
    const data = this.result();
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
    const data = this.result();
    if (!data) return;

    const doc = new jsPDF();
    
    // Watermark
    doc.setFontSize(10);
    doc.setTextColor(255, 0, 0); // Red
    doc.text('DRAFT SCHEMA - DO NOT USE FOR ENROLLMENT. Execute the generated R/SAS/Python script to generate the official trial schema.', 14, 12);

    // Header
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0); // Black
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
      headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
      styles: { fontSize: 9, cellPadding: 3 },
    });

    doc.save(`randomization_${data.metadata.protocolId}_${this.isUnblinded() ? 'unblinded' : 'blinded'}.pdf`);
  }
}
