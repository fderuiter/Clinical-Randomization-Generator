import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UpdateNotificationService } from '../services/update-notification.service';

/**
 * UpdateBannerComponent
 *
 * A non-intrusive sticky banner displayed at the top of the viewport when
 * a new version of the application has been cached by the Service Worker.
 * Prompts the user to reload and apply the update.
 *
 * Rendered conditionally by the root App component based on the
 * `updateAvailable` signal from `UpdateNotificationService`.
 */
@Component({
  selector: 'app-update-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="status"
      aria-live="polite"
      class="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-4 bg-indigo-700 dark:bg-indigo-800 text-white px-4 py-2.5 text-sm shadow-lg"
    >
      <div class="flex items-center gap-2.5">
        <!-- Download / refresh icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>A new version of Equipose is available.</span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          (click)="updateService.activateUpdate()"
          class="rounded-md bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 px-3 py-1 font-medium transition-colors"
        >
          Reload &amp; Update
        </button>
        <button
          type="button"
          (click)="updateService.dismiss()"
          aria-label="Dismiss update notification"
          title="Dismiss update notification"
          class="rounded-md p-1 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  `
})
export class UpdateBannerComponent {
  protected readonly updateService = inject(UpdateNotificationService);
}
