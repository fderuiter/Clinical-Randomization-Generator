import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { VersionHistoryService } from '../version-history.service';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { Router } from '@angular/router';

@Component({
  selector: 'app-version-dashboard',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="bg-surface rounded-xl shadow-sm border border-border-subtle overflow-hidden mt-6">
      <div class="p-6 border-b border-border-subtle">
        <h2 class="text-xl font-bold text-main">Version History & Compliance Ledger</h2>
        <p class="text-sm text-muted mt-1">Audit log of all saved design iterations for the current protocol.</p>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead class="bg-subtle/50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Version</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Timestamp</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Operator ID</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Reason for Change</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Audit Hash</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-surface divide-y divide-gray-200 dark:divide-slate-700">
            @for (version of versionHistory.versions(); track version.id) {
              <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-main">{{ version.versionNumber }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-muted">{{ version.timestamp | date:'medium' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-main font-semibold">{{ version.operatorId }}</td>
                <td class="px-6 py-4 text-sm text-muted max-w-md truncate" [title]="version.reasonForChange">{{ version.reasonForChange }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-muted">
                  {{ version.schemaHash.substring(0, 12) }}...{{ version.schemaHash.substring(version.schemaHash.length - 12) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button (click)="restoreVersion(version.id)" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4">Restore State</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-6 py-8 text-center text-sm text-muted">No versions saved yet.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class VersionDashboardComponent {
  public readonly versionHistory = inject(VersionHistoryService);
  private readonly facade = inject(RandomizationEngineFacade);
  private readonly router = inject(Router);

  async restoreVersion(id: string) {
    const version = await this.versionHistory.getVersion(id);
    if (version) {
      this.versionHistory.configToRestore.set(version.config);
      this.facade.generateSchema(version.config);
      this.router.navigate(['/generator']);
    }
  }
}
