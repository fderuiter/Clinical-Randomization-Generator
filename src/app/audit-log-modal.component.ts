import { Component, EventEmitter, Output, inject, signal, OnInit } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { RandomizationService, AuditLogEntry } from './randomization.service';

@Component({
  selector: 'app-audit-log-modal',
  standalone: true,
  imports: [DatePipe, JsonPipe],
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" (click)="close.emit()"></div>

        <!-- This element is to trick the browser into centering the modal contents. -->
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <!-- Modal panel -->
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  Audit Logs
                </h3>
                <div class="mt-4">
                  @if (isLoading()) {
                    <div class="flex justify-center py-8">
                      <svg class="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  } @else if (error()) {
                    <div class="text-red-600 text-sm">{{ error() }}</div>
                  } @else if (logs().length === 0) {
                    <div class="text-gray-500 text-sm py-8 text-center">No audit logs found.</div>
                  } @else {
                    <div class="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                      @for (log of logs(); track log.timestamp) {
                        <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div class="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <span class="block text-xs font-medium text-gray-500 uppercase">Timestamp</span>
                              <span class="block text-sm text-gray-900">{{ log.timestamp | date:'medium' }}</span>
                            </div>
                            <div>
                              <span class="block text-xs font-medium text-gray-500 uppercase">User ID</span>
                              <span class="block text-sm text-gray-900">{{ log.userId }}</span>
                            </div>
                            <div>
                              <span class="block text-xs font-medium text-gray-500 uppercase">Protocol ID</span>
                              <span class="block text-sm text-gray-900">{{ log.protocolId }}</span>
                            </div>
                            <div>
                              <span class="block text-xs font-medium text-gray-500 uppercase">Seed</span>
                              <span class="block text-sm font-mono bg-gray-200 px-1 rounded">{{ log.seed }}</span>
                            </div>
                          </div>
                          
                          <div class="mb-4">
                            <span class="block text-xs font-medium text-gray-500 uppercase mb-1">Parameters</span>
                            <pre class="bg-gray-800 text-gray-100 p-3 rounded-md text-xs overflow-x-auto">{{ log.parameters | json }}</pre>
                          </div>

                          <div>
                            <span class="block text-xs font-medium text-gray-500 uppercase mb-1">Randomization Code</span>
                            <pre class="bg-gray-800 text-gray-100 p-3 rounded-md text-xs overflow-x-auto"><code>{{ log.randomizationCode }}</code></pre>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" (click)="close.emit()">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AuditLogModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  
  private randomizationService = inject(RandomizationService);
  
  logs = signal<AuditLogEntry[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.fetchLogs();
  }

  fetchLogs() {
    this.isLoading.set(true);
    this.error.set(null);
    this.randomizationService.getAuditLogs().subscribe({
      next: (data) => {
        // Sort descending by timestamp
        this.logs.set(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch audit logs', err);
        this.error.set('Failed to load audit logs.');
        this.isLoading.set(false);
      }
    });
  }
}
