import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ThemeService, ThemeMode } from './theme.service';
import { vi } from 'vitest';

describe('ThemeService', () => {
  let service: ThemeService;
  let mockDocument: { documentElement: { classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; contains: ReturnType<typeof vi.fn> } } };
  let mockMatchMedia: ReturnType<typeof vi.fn>;
  let mediaQueryListeners: ((e: MediaQueryListEvent) => void)[];

  beforeEach(() => {
    mediaQueryListeners = [];
    mockDocument = {
      documentElement: {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn()
        }
      }
    };

    mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
        mediaQueryListeners.push(handler);
      }
    });

    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, writable: true, configurable: true });
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: mockDocument }
      ]
    });
    service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('should default to System mode when no saved preference exists', () => {
    expect(service.mode()).toBe('System');
  });

  it('should load saved Dark mode from localStorage on construction', () => {
    localStorage.setItem('theme-preference', 'Dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: mockDocument }
      ]
    });
    const newService = TestBed.inject(ThemeService);
    expect(newService.mode()).toBe('Dark');
  });

  it('should load saved Light mode from localStorage on construction', () => {
    localStorage.setItem('theme-preference', 'Light');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: mockDocument }
      ]
    });
    const newService = TestBed.inject(ThemeService);
    expect(newService.mode()).toBe('Light');
  });

  it('should be Light (not dark) when mode is Light regardless of system preference', () => {
    service.setMode('Light');
    TestBed.flushEffects();
    expect(service.isDark()).toBe(false);
  });

  it('should be Dark when mode is Dark regardless of system preference', () => {
    service.setMode('Dark');
    TestBed.flushEffects();
    expect(service.isDark()).toBe(true);
  });

  it('should follow system preference when mode is System and system is light', () => {
    service.setMode('System');
    TestBed.flushEffects();
    // mockMatchMedia returns matches: false (light)
    expect(service.isDark()).toBe(false);
  });

  it('should add dark class to html element when isDark is true', () => {
    service.setMode('Dark');
    TestBed.flushEffects();
    expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('dark');
  });

  it('should remove dark class from html element when isDark is false', () => {
    service.setMode('Light');
    TestBed.flushEffects();
    expect(mockDocument.documentElement.classList.remove).toHaveBeenCalledWith('dark');
  });

  it('should save mode to localStorage when setMode is called', () => {
    service.setMode('Dark');
    expect(localStorage.getItem('theme-preference')).toBe('Dark');
    service.setMode('Light');
    expect(localStorage.getItem('theme-preference')).toBe('Light');
    service.setMode('System');
    expect(localStorage.getItem('theme-preference')).toBe('System');
  });

  it('should update isDark when OS theme changes to dark via media query event', () => {
    service.setMode('System');
    TestBed.flushEffects();
    expect(service.isDark()).toBe(false);

    // Simulate OS switching to dark
    mediaQueryListeners.forEach(handler =>
      handler({ matches: true } as MediaQueryListEvent)
    );
    TestBed.flushEffects();
    expect(service.isDark()).toBe(true);
  });

  it('should not update isDark on OS change when mode is explicitly Light', () => {
    service.setMode('Light');
    TestBed.flushEffects();

    // Simulate OS switching to dark
    mediaQueryListeners.forEach(handler =>
      handler({ matches: true } as MediaQueryListEvent)
    );
    TestBed.flushEffects();
    // Still light because mode is explicitly 'Light'
    expect(service.isDark()).toBe(false);
  });
});
