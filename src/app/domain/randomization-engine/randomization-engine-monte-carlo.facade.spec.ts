import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RandomizationEngineFacade } from './randomization-engine.facade';
import { RandomizationService } from './randomization.service';
import { RandomizationConfig } from '../core/models/randomization.model';
import { vi } from 'vitest';
import type { MonteCarloProgressPayload, MonteCarloSuccessPayload } from './worker/worker-protocol';

/** Flush all pending microtasks so async signals settle. */
const flushMicrotasks = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const mockConfig: RandomizationConfig = {
  protocolId: 'TEST-123',
  studyName: 'Test Study',
  phase: 'Phase I',
  arms: [
    { id: 'A', name: 'Active', ratio: 1 },
    { id: 'B', name: 'Placebo', ratio: 1 }
  ],
  sites: ['Site1'],
  strata: [],
  blockSizes: [2],
  stratumCaps: [{ levels: [], cap: 10 }],
  seed: 'test_seed',
  subjectIdMask: '[SiteID]-[001]'
};

const mockMonteCarloSuccess: MonteCarloSuccessPayload = {
  totalIterations: 10_000,
  totalSubjectsSimulated: 100_000,
  arms: [
    { armId: 'A', armName: 'Active', ratio: 1, expectedCount: 50_000, actualCount: 50_012 },
    { armId: 'B', armName: 'Placebo', ratio: 1, expectedCount: 50_000, actualCount: 49_988 }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Worker stub
// ─────────────────────────────────────────────────────────────────────────────

class FakeWorker {
  postMessage = vi.fn();
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  simulateMessage(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Specs
// ─────────────────────────────────────────────────────────────────────────────

describe('RandomizationEngineFacade – Monte Carlo', () => {
  let facade: RandomizationEngineFacade;
  let fakeWorker: FakeWorker;

  beforeEach(() => {
    fakeWorker = new FakeWorker();
    // Mock crypto.subtle.digest to avoid relative-import vi.mock restrictions in Angular's test system
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer);

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: RandomizationService, useValue: { generateSchema: vi.fn() } }
      ]
    });

    facade = TestBed.inject(RandomizationEngineFacade);

    vi.stubGlobal('Worker', function () { return fakeWorker; });
    (facade as unknown as { initWorker: () => void }).initWorker();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should initialise Monte Carlo signals to their default state', () => {
    expect(facade.isMonteCarloRunning()).toBe(false);
    expect(facade.monteCarloProgress()).toBe(0);
    expect(facade.monteCarloResults()).toBeNull();
    expect(facade.showMonteCarloModal()).toBe(false);
  });

  it('should open the modal and set running=true when runMonteCarlo is called', () => {
    facade.runMonteCarlo(mockConfig);
    expect(facade.showMonteCarloModal()).toBe(true);
    expect(facade.isMonteCarloRunning()).toBe(true);
    expect(facade.monteCarloProgress()).toBe(0);
  });

  it('should postMessage with START_MONTE_CARLO command', () => {
    facade.runMonteCarlo(mockConfig);
    expect(fakeWorker.postMessage).toHaveBeenCalledTimes(1);
    const msg = fakeWorker.postMessage.mock.calls[0][0];
    expect(msg.command).toBe('START_MONTE_CARLO');
    expect(msg.payload).toEqual(mockConfig);
  });

  it('should update progress on MONTE_CARLO_PROGRESS messages', () => {
    facade.runMonteCarlo(mockConfig);
    const { id } = fakeWorker.postMessage.mock.calls[0][0] as { id: string };

    const progressPayload: MonteCarloProgressPayload = {
      iterationsCompleted: 5_000,
      totalIterations: 10_000
    };
    fakeWorker.simulateMessage({ id, type: 'MONTE_CARLO_PROGRESS', payload: progressPayload });

    expect(facade.monteCarloProgress()).toBe(50);
    // Still running - no success yet
    expect(facade.isMonteCarloRunning()).toBe(true);
  });

  it('should set results and stop running on MONTE_CARLO_SUCCESS', () => {
    facade.runMonteCarlo(mockConfig);
    const { id } = fakeWorker.postMessage.mock.calls[0][0] as { id: string };

    fakeWorker.simulateMessage({ id, type: 'MONTE_CARLO_SUCCESS', payload: mockMonteCarloSuccess });

    expect(facade.monteCarloResults()).toEqual(mockMonteCarloSuccess);
    expect(facade.isMonteCarloRunning()).toBe(false);
    expect(facade.monteCarloProgress()).toBe(100);
    expect(facade.showMonteCarloModal()).toBe(true); // modal stays open to show results
  });

  it('should close the modal and reset state when closeMonteCarloModal is called', () => {
    facade.runMonteCarlo(mockConfig);
    const { id } = fakeWorker.postMessage.mock.calls[0][0] as { id: string };
    fakeWorker.simulateMessage({ id, type: 'MONTE_CARLO_SUCCESS', payload: mockMonteCarloSuccess });

    facade.closeMonteCarloModal();

    expect(facade.showMonteCarloModal()).toBe(false);
    expect(facade.monteCarloResults()).toBeNull();
    expect(facade.monteCarloProgress()).toBe(0);
  });

  it('should NOT affect standard generation pending callbacks when a Monte Carlo message is received', async () => {
    facade.generateSchema(mockConfig);
    const genId = (fakeWorker.postMessage.mock.calls[0][0] as { id: string }).id;

    facade.runMonteCarlo(mockConfig);
    const mcId = (fakeWorker.postMessage.mock.calls[1][0] as { id: string }).id;

    // Deliver Monte Carlo success first
    fakeWorker.simulateMessage({ id: mcId, type: 'MONTE_CARLO_SUCCESS', payload: mockMonteCarloSuccess });
    expect(facade.results()).toBeNull(); // still null - generation not resolved

    // Now resolve the generation
    const mockResult = {
      metadata: { protocolId: 'TEST-123', studyName: 'Test Study', phase: 'Phase I', seed: 'test_seed', generatedAt: '2023-01-01', strata: [], auditHash: 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233', config: mockConfig },
      schema: []
    };
    fakeWorker.simulateMessage({ id: genId, type: 'GENERATION_SUCCESS', payload: mockResult });
    await flushMicrotasks();
    expect(facade.results()).toMatchObject({ metadata: expect.objectContaining({ protocolId: 'TEST-123' }) });
  });
});
