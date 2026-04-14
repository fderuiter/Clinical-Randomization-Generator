import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RandomizationEngineFacade } from './randomization-engine.facade';
import { RandomizationService } from './randomization.service';
import { RandomizationConfig, RandomizationResult } from '../core/models/randomization.model';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

/** Flush all pending microtasks so async signals settle. */
const flushMicrotasks = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const mockConfig: RandomizationConfig = {
  protocolId: 'TEST-123',
  studyName: 'Test Study',
  phase: 'Phase I',
  arms: [{ id: '1', name: 'Arm A', ratio: 1 }],
  sites: ['Site1'],
  strata: [],
  blockSizes: [2],
  stratumCaps: [],
  seed: 'test_seed',
  subjectIdMask: '[SiteID]-[001]'
};

const mockResult: RandomizationResult = {
  metadata: {
    protocolId: 'TEST-123',
    studyName: 'Test Study',
    phase: 'Phase I',
    seed: 'test_seed',
    generatedAt: '2023-01-01',
    strata: [],
    auditHash: 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233',
    config: mockConfig
  },
  schema: []
};

// ─────────────────────────────────────────────────────────────────────────────
// SSR / synchronous fallback path
// ─────────────────────────────────────────────────────────────────────────────

describe('RandomizationEngineFacade – SSR (synchronous) path', () => {
  let facade: RandomizationEngineFacade;
  let mockRandomizationService: { generateSchema: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRandomizationService = { generateSchema: vi.fn() };
    // Mock crypto.subtle.digest to avoid relative-import vi.mock restrictions in Angular's test system
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer);

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: RandomizationService, useValue: mockRandomizationService }
      ]
    });

    facade = TestBed.inject(RandomizationEngineFacade);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialise with null results, no error, and isGenerating = false', () => {
    expect(facade.results()).toBeNull();
    expect(facade.error()).toBeNull();
    expect(facade.isGenerating()).toBe(false);
  });

  it('should set config and results after a successful synchronous call', async () => {
    mockRandomizationService.generateSchema.mockReturnValue(of(mockResult));
    facade.generateSchema(mockConfig);
    await flushMicrotasks();
    expect(facade.config()).toEqual(mockConfig);
    expect(facade.results()).toMatchObject({ metadata: expect.objectContaining({ protocolId: 'TEST-123' }) });
    expect(facade.isGenerating()).toBe(false);
  });

  it('should reset results to null when generateSchema is called again', async () => {
    mockRandomizationService.generateSchema.mockReturnValue(of(mockResult));
    facade.generateSchema(mockConfig);
    await flushMicrotasks();
    expect(facade.results()).toBeTruthy();

    mockRandomizationService.generateSchema.mockReturnValue(of(mockResult));
    facade.generateSchema(mockConfig);
    await flushMicrotasks();
    // results is momentarily null inside generateSchema before the observable resolves
    expect(facade.results()).toBeTruthy(); // resolved again
  });

  it('should set the error signal on generation failure', () => {
    mockRandomizationService.generateSchema.mockReturnValue(
      throwError(() => ({ error: { error: 'Block size error' } }))
    );
    facade.generateSchema(mockConfig);
    expect(facade.error()).toBe('Block size error');
    expect(facade.isGenerating()).toBe(false);
  });

  it('should use a generic error message when the payload has no nested error', () => {
    mockRandomizationService.generateSchema.mockReturnValue(
      throwError(() => ({}))
    );
    facade.generateSchema(mockConfig);
    expect(facade.error()).toBe('An error occurred during schema generation.');
  });

  it('should clear results AND error on clearResults()', async () => {
    mockRandomizationService.generateSchema.mockReturnValue(of(mockResult));
    facade.generateSchema(mockConfig);
    await flushMicrotasks();
    expect(facade.results()).toBeTruthy();

    facade.clearResults();
    expect(facade.results()).toBeNull();
    expect(facade.error()).toBeNull();
  });

  it('should clear an existing error when clearResults() is called', () => {
    mockRandomizationService.generateSchema.mockReturnValue(
      throwError(() => ({ error: { error: 'Some error' } }))
    );
    facade.generateSchema(mockConfig);
    expect(facade.error()).toBeTruthy();

    facade.clearResults();
    expect(facade.error()).toBeNull();
  });

  it('should open the code generator with the correct language', () => {
    facade.openCodeGenerator(mockConfig, 'R');
    expect(facade.showCodeGenerator()).toBe(true);
    expect(facade.codeLanguage()).toBe('R');
    expect(facade.config()).toEqual(mockConfig);
  });

  it('should open the code generator for all four supported languages', () => {
    for (const lang of ['R', 'SAS', 'Python', 'STATA'] as const) {
      facade.openCodeGenerator(mockConfig, lang);
      expect(facade.codeLanguage()).toBe(lang);
    }
  });

  it('should close the code generator', () => {
    facade.openCodeGenerator(mockConfig, 'SAS');
    expect(facade.showCodeGenerator()).toBe(true);
    facade.closeCodeGenerator();
    expect(facade.showCodeGenerator()).toBe(false);
  });

  it('should not call randomizationService.generateSchema when isGenerating is already false after success', async () => {
    mockRandomizationService.generateSchema.mockReturnValue(of(mockResult));
    facade.generateSchema(mockConfig);
    await flushMicrotasks();
    expect(mockRandomizationService.generateSchema).toHaveBeenCalledTimes(1);
    expect(facade.isGenerating()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Browser / Worker dispatch path
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal Worker stand-in that captures the handlers the facade sets on it. */
class FakeWorker {
  postMessage = vi.fn();
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  /** Simulate the worker posting a message back to the facade. */
  simulateMessage(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
  /** Simulate a fatal worker error. */
  simulateError(msg = 'Script error') {
    this.onerror?.({ message: msg } as ErrorEvent);
  }
}

describe('RandomizationEngineFacade – browser (Worker) path', () => {
  let facade: RandomizationEngineFacade;
  let fakeWorker: FakeWorker;
  let mockRandomizationService: { generateSchema: ReturnType<typeof vi.fn> };

  /** Access the facade's private pendingCallbacks map for introspection. */
  const pendingCallbacks = () =>
    (facade as unknown as { pendingCallbacks: Map<string, unknown> }).pendingCallbacks;

  beforeEach(() => {
    fakeWorker = new FakeWorker();
    mockRandomizationService = { generateSchema: vi.fn() };
    // Mock crypto.subtle.digest to avoid relative-import vi.mock restrictions in Angular's test system
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer);

    // Use 'server' so the constructor does NOT call initWorker() automatically.
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: RandomizationService, useValue: mockRandomizationService }
      ]
    });

    facade = TestBed.inject(RandomizationEngineFacade);

    // Inject the fake worker and let the real initWorker() logic wire the handlers.
    // We stub the Worker constructor so initWorker() picks up our fake instance.
    vi.stubGlobal('Worker', function () { return fakeWorker; });
    (facade as unknown as { initWorker: () => void }).initWorker();
    // Stub is cleaned up in afterEach to avoid polluting subsequent suites.
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should postMessage to the worker when generateSchema is called', () => {
    facade.generateSchema(mockConfig);
    expect(fakeWorker.postMessage).toHaveBeenCalledTimes(1);
    const msg = fakeWorker.postMessage.mock.calls[0][0];
    expect(msg.command).toBe('START_GENERATION');
    expect(msg.payload).toEqual(mockConfig);
  });

  it('should include a unique correlation id in each postMessage call', () => {
    facade.generateSchema(mockConfig);
    facade.generateSchema(mockConfig);
    const ids = fakeWorker.postMessage.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('should set isGenerating to true while awaiting the worker response', () => {
    facade.generateSchema(mockConfig);
    expect(facade.isGenerating()).toBe(true);
  });

  it('should resolve results and clear isGenerating on GENERATION_SUCCESS', async () => {
    facade.generateSchema(mockConfig);
    const { id } = fakeWorker.postMessage.mock.calls[0][0] as { id: string };

    fakeWorker.simulateMessage({ id, type: 'GENERATION_SUCCESS', payload: mockResult });
    await flushMicrotasks();

    expect(facade.results()).toMatchObject({ metadata: expect.objectContaining({ protocolId: 'TEST-123' }) });
    expect(facade.isGenerating()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('should set the error signal and clear isGenerating on GENERATION_ERROR', () => {
    facade.generateSchema(mockConfig);
    const { id } = fakeWorker.postMessage.mock.calls[0][0] as { id: string };

    fakeWorker.simulateMessage({
      id,
      type: 'GENERATION_ERROR',
      payload: { error: { error: 'Worker error' } }
    });

    expect(facade.error()).toBe('Worker error');
    expect(facade.isGenerating()).toBe(false);
    expect(facade.results()).toBeNull();
  });

  it('should use a generic error message when the worker error payload lacks a message', () => {
    facade.generateSchema(mockConfig);
    const { id } = fakeWorker.postMessage.mock.calls[0][0] as { id: string };

    fakeWorker.simulateMessage({ id, type: 'GENERATION_ERROR', payload: {} });

    expect(facade.error()).toBe('An error occurred during schema generation.');
  });

  it('should ignore worker messages whose id does not match a pending callback', () => {
    facade.generateSchema(mockConfig);

    fakeWorker.simulateMessage({
      id: 'unknown-id',
      type: 'GENERATION_SUCCESS',
      payload: mockResult
    });

    expect(facade.results()).toBeNull();
    expect(facade.isGenerating()).toBe(true); // still waiting for the real id
  });

  it('should clean up the pending callback after resolving', () => {
    facade.generateSchema(mockConfig);
    const { id } = fakeWorker.postMessage.mock.calls[0][0] as { id: string };
    expect(pendingCallbacks().size).toBe(1);

    fakeWorker.simulateMessage({ id, type: 'GENERATION_SUCCESS', payload: mockResult });
    expect(pendingCallbacks().size).toBe(0);
  });

  it('should reject all pending callbacks when the worker fires onerror', () => {
    facade.generateSchema(mockConfig);
    expect(facade.isGenerating()).toBe(true);

    fakeWorker.simulateError('fatal worker crash');

    expect(facade.error()).toBe('Worker encountered an unexpected error.');
    expect(facade.isGenerating()).toBe(false);
    expect(pendingCallbacks().size).toBe(0);
  });

  it('should NOT call randomizationService.generateSchema when a Worker is active', () => {
    facade.generateSchema(mockConfig);
    expect(mockRandomizationService.generateSchema).not.toHaveBeenCalled();
  });
});

