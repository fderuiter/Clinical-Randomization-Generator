import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

/**
 * UpdateNotificationService
 *
 * Listens to Angular Service Worker lifecycle events and exposes a reactive
 * signal that the UI can use to display a non-intrusive update-available
 * banner.  When the user confirms, the page reloads to activate the new
 * cache and service worker version.
 *
 * If the `SwUpdate` service is not enabled (e.g. in development mode or
 * when the service worker is not registered), this service becomes a no-op
 * so that the rest of the application is unaffected.
 */
@Injectable({ providedIn: 'root' })
export class UpdateNotificationService {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  /** True when a new application version has been detected and is ready. */
  readonly updateAvailable = signal(false);

  constructor() {
    if (!this.swUpdate?.isEnabled) {
      return;
    }

    // Listen for the SW telling us a new version is ready to activate.
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.updateAvailable.set(true);
      });
  }

  /** Reload the page to activate the waiting service worker and new cache. */
  activateUpdate(): void {
    this.swUpdate?.activateUpdate().then(() => {
      document.location.reload();
    });
  }

  /** Dismiss the banner without reloading (user can reload manually later). */
  dismiss(): void {
    this.updateAvailable.set(false);
  }
}
