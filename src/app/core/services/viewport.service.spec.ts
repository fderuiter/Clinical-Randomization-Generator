import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ViewportService } from './viewport.service';
import { vi } from 'vitest';
import { Subject } from 'rxjs';

describe('ViewportService', () => {
  let service: ViewportService;
  let breakpointSubject: Subject<{ matches: boolean; breakpoints: Record<string, boolean> }>;
  let mockBreakpointObserver: { observe: ReturnType<typeof vi.fn> };

  function buildBreakpointState(active: string[]): { matches: boolean; breakpoints: Record<string, boolean> } {
    const allKeys = [Breakpoints.Handset, Breakpoints.TabletPortrait, Breakpoints.TabletLandscape];
    const breakpoints: Record<string, boolean> = {};
    for (const key of allKeys) {
      breakpoints[key] = active.includes(key);
    }
    return { matches: active.length > 0, breakpoints };
  }

  beforeEach(() => {
    breakpointSubject = new Subject();
    mockBreakpointObserver = {
      observe: vi.fn().mockReturnValue(breakpointSubject.asObservable())
    };

    TestBed.configureTestingModule({
      providers: [
        ViewportService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: BreakpointObserver, useValue: mockBreakpointObserver }
      ]
    });

    service = TestBed.inject(ViewportService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create the service', () => {
    expect(service).toBeTruthy();
  });

  it('should default to desktop before any breakpoint fires', () => {
    expect(service.viewportSize()).toBe('desktop');
    expect(service.isDesktop()).toBe(true);
    expect(service.isMobile()).toBe(false);
    expect(service.isTablet()).toBe(false);
  });

  it('should set viewportSize to "mobile" when Handset breakpoint matches', () => {
    TestBed.runInInjectionContext(() => {
      breakpointSubject.next(buildBreakpointState([Breakpoints.Handset]));
      expect(service.viewportSize()).toBe('mobile');
      expect(service.isMobile()).toBe(true);
      expect(service.isTablet()).toBe(false);
      expect(service.isDesktop()).toBe(false);
    });
  });

  it('should set viewportSize to "tablet" when TabletPortrait breakpoint matches', () => {
    TestBed.runInInjectionContext(() => {
      breakpointSubject.next(buildBreakpointState([Breakpoints.TabletPortrait]));
      expect(service.viewportSize()).toBe('tablet');
      expect(service.isTablet()).toBe(true);
      expect(service.isMobile()).toBe(false);
      expect(service.isDesktop()).toBe(false);
    });
  });

  it('should set viewportSize to "tablet" when TabletLandscape breakpoint matches', () => {
    TestBed.runInInjectionContext(() => {
      breakpointSubject.next(buildBreakpointState([Breakpoints.TabletLandscape]));
      expect(service.viewportSize()).toBe('tablet');
      expect(service.isTablet()).toBe(true);
    });
  });

  it('should set viewportSize to "desktop" when no handset/tablet breakpoint matches', () => {
    TestBed.runInInjectionContext(() => {
      breakpointSubject.next(buildBreakpointState([]));
      expect(service.viewportSize()).toBe('desktop');
      expect(service.isDesktop()).toBe(true);
    });
  });

  it('should react to breakpoint changes over time (mobile → tablet → desktop)', () => {
    TestBed.runInInjectionContext(() => {
      breakpointSubject.next(buildBreakpointState([Breakpoints.Handset]));
      expect(service.viewportSize()).toBe('mobile');

      breakpointSubject.next(buildBreakpointState([Breakpoints.TabletPortrait]));
      expect(service.viewportSize()).toBe('tablet');

      breakpointSubject.next(buildBreakpointState([]));
      expect(service.viewportSize()).toBe('desktop');
    });
  });

  it('should default to desktop on non-browser platforms (SSR)', () => {
    const ssrBreakpointSubject = new Subject<{ matches: boolean; breakpoints: Record<string, boolean> }>();
    const ssrBreakpointObserver = { observe: vi.fn().mockReturnValue(ssrBreakpointSubject.asObservable()) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ViewportService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: BreakpointObserver, useValue: ssrBreakpointObserver }
      ]
    });
    const ssrService = TestBed.inject(ViewportService);
    expect(ssrService.viewportSize()).toBe('desktop');
    // BreakpointObserver should not be called on non-browser platforms
    expect(ssrBreakpointObserver.observe).not.toHaveBeenCalled();
  });

  it('should observe all three breakpoint keys', () => {
    expect(mockBreakpointObserver.observe).toHaveBeenCalledWith([
      Breakpoints.Handset,
      Breakpoints.TabletPortrait,
      Breakpoints.TabletLandscape,
    ]);
  });
});
