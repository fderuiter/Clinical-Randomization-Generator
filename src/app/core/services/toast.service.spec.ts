import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ToastService } from './toast.service';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('ToastService (server/SSR platform – no overlay creation)', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' }
      ]
    });

    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with an empty toasts array', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('showSuccess() should add a toast with type "success"', () => {
    service.showSuccess('All good!');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].type).toBe('success');
    expect(service.toasts()[0].message).toBe('All good!');
  });

  it('showError() should add a toast with type "error"', () => {
    service.showError('Something went wrong');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].type).toBe('error');
  });

  it('showInfo() should add a toast with type "info"', () => {
    service.showInfo('For your information');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].type).toBe('info');
  });

  it('each toast should receive a unique id', () => {
    service.showSuccess('First');
    service.showSuccess('Second');
    const [a, b] = service.toasts();
    expect(a.id).not.toBe(b.id);
  });

  it('dismiss() should remove the toast with the given id', () => {
    service.showSuccess('A');
    service.showError('B');
    const idToRemove = service.toasts()[0].id;

    service.dismiss(idToRemove);

    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('B');
  });

  it('dismiss() with unknown id should leave toasts unchanged', () => {
    service.showSuccess('Only toast');
    service.dismiss('non-existent-id');
    expect(service.toasts().length).toBe(1);
  });

  it('success toasts should auto-dismiss after 3000 ms', () => {
    vi.useFakeTimers();
    service.showSuccess('Auto-dismiss me');
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(3000);
    expect(service.toasts().length).toBe(0);
  });

  it('info toasts should auto-dismiss after 3000 ms', () => {
    vi.useFakeTimers();
    service.showInfo('Info auto-dismiss');
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(3000);
    expect(service.toasts().length).toBe(0);
  });

  it('error toasts should NOT auto-dismiss', () => {
    vi.useFakeTimers();
    service.showError('Persistent error');
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(10_000);
    expect(service.toasts().length).toBe(1);
  });

  it('multiple toasts can be queued simultaneously', () => {
    service.showSuccess('S1');
    service.showError('E1');
    service.showInfo('I1');
    expect(service.toasts().length).toBe(3);
  });

  it('should not create an overlay on server platform', () => {
    // Overlay creation is guarded by isBrowser; in SSR context it must not throw.
    expect(() => service.showError('SSR error')).not.toThrow();
    // No overlay ref should be set (private field check via type cast)
    const overlayRef = (service as unknown as { overlayRef: unknown }).overlayRef;
    expect(overlayRef).toBeNull();
  });
});
