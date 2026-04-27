import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ToastComponent } from '../components/toast.component';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

/** Duration (ms) before a non-error toast auto-dismisses. */
const AUTO_DISMISS_MS = 3000;

/**
 * ToastService
 *
 * Global, non-blocking notification system backed by the Angular CDK Overlay.
 * The service lazily creates a single overlay anchored to the bottom-right of
 * the viewport and attaches a `ToastComponent` to it.  All individual
 * notifications are stored in the reactive `toasts` signal so the component
 * re-renders automatically when the collection changes.
 *
 * Usage:
 *   toastService.showSuccess('Schema generated successfully!');
 *   toastService.showError('Block size mismatch – see details.');
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly overlay = inject(Overlay);

  /** Reactive list of active toast messages consumed by `ToastComponent`. */
  readonly toasts = signal<ToastMessage[]>([]);

  private overlayRef: OverlayRef | null = null;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Show a success toast that auto-dismisses after 3 s. */
  showSuccess(message: string): void {
    this.show(message, 'success');
  }

  /**
   * Show an error toast that persists until the user explicitly dismisses it.
   * This replaces disruptive `window.alert()` calls for critical failures.
   */
  showError(message: string): void {
    this.show(message, 'error');
  }

  /** Show an informational toast that auto-dismisses after 3 s. */
  showInfo(message: string): void {
    this.show(message, 'info');
  }

  /**
   * Dismiss a specific toast by its unique id.
   * Called internally for auto-dismiss and externally from the template's
   * close button for persistent error toasts.
   */
  dismiss(id: string): void {
    this.toasts.update(ts => ts.filter(t => t.id !== id));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private show(message: string, type: ToastType): void {
    const id = globalThis.crypto.randomUUID();
    const toast: ToastMessage = { id, message, type };

    this.toasts.update(ts => [...ts, toast]);
    this.ensureContainerAttached();

    // Error toasts must persist until manually dismissed.
    if (type !== 'error') {
      setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS);
    }
  }

  /**
   * Lazily creates the CDK overlay and attaches the `ToastComponent` to it.
   * Subsequent calls are no-ops once the overlay has been initialised.
   * Guarded against SSR environments where `Overlay` is unavailable.
   */
  private ensureContainerAttached(): void {
    if (!this.isBrowser || this.overlayRef) return;

    const positionStrategy = this.overlay
      .position()
      .global()
      .bottom('24px')
      .right('24px');

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: false,
      panelClass: 'toast-overlay-panel',
    });

    const portal = new ComponentPortal(ToastComponent);
    this.overlayRef.attach(portal);
  }
}
