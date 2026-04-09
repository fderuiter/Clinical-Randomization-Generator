import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal
} from '@angular/core';
import { ToastMessage, ToastService } from '../services/toast.service';

/**
 * ToastComponent
 *
 * Renders the full stack of active toast notifications anchored to the
 * bottom-right of the viewport.  One instance of this component is
 * dynamically attached to a CDK overlay by `ToastService`; it reads the
 * shared `toasts` signal so the list stays reactive without requiring
 * any direct input/output communication between the overlay and the rest
 * of the app.
 *
 * Individual toast items support:
 *   - Auto-dismiss for Success / Info types (handled by the service).
 *   - A persistent close button for Error types.
 *   - Full keyboard navigation: `Tab` to focus the dismiss button,
 *     `Enter` / `Space` to close.
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      class="flex flex-col gap-3 items-end pointer-events-none"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          role="alert"
          [attr.aria-atomic]="true"
          class="pointer-events-auto flex items-start gap-3 rounded-xl shadow-lg border px-4 py-3 min-w-72 max-w-sm text-sm transition-all"
          [class]="toastClasses(toast)"
        >
          <!-- Icon -->
          <span class="flex-shrink-0 mt-0.5" [attr.aria-hidden]="true">
            @switch (toast.type) {
              @case ('success') {
                <svg class="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                </svg>
              }
              @case ('error') {
                <svg class="h-5 w-5 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
                </svg>
              }
              @default {
                <svg class="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd" />
                </svg>
              }
            }
          </span>

          <!-- Message -->
          <p class="flex-1 leading-snug">{{ toast.message }}</p>

          <!-- Dismiss button (always shown for errors; others auto-dismiss) -->
          @if (toast.type === 'error') {
            <button
              type="button"
              class="flex-shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-rose-400 text-rose-400 hover:text-rose-600 transition-colors"
              [attr.aria-label]="'Dismiss error: ' + toast.message"
              (click)="toastService.dismiss(toast.id)"
            >
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          }
        </div>
      }
    </div>
  `
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);

  /** Returns the Tailwind class string for a toast based on its type. */
  toastClasses(toast: ToastMessage): string {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100';
      case 'error':
        return 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700 text-rose-900 dark:text-rose-100';
      default:
        return 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100';
    }
  }
}
