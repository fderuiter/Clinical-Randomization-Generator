import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ConfigStorageService, STORAGE_KEY, StoredDraft, DraftConfig } from './config-storage.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockConfig: DraftConfig = {
  protocolId: 'PRT-001',
  studyName: 'Demo Study',
  phase: 'III',
  arms: [{ id: 'A', name: 'Active', ratio: 1 }],
  strata: [{ id: 'age', name: 'Age Group', levelsStr: '<65, >=65' }],
  sitesStr: '101, 102',
  blockSizesStr: '4',
  stratumCaps: [{ levels: ['<65'], cap: 20 }],
  seed: 'abc',
  subjectIdMask: '[SiteID]-[001]'
};

describe('ConfigStorageService', () => {
  let service: ConfigStorageService;
  let storageStore: Record<string, string> = {};

  beforeEach(() => {
    storageStore = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => storageStore[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => { storageStore[key] = value; });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => { delete storageStore[key]; });

    TestBed.configureTestingModule({
      providers: [ConfigStorageService, { provide: PLATFORM_ID, useValue: 'browser' }]
    });
    service = TestBed.inject(ConfigStorageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('saveDraft()', () => {
    it('should write a StoredDraft with schemaVersion and savedAt to localStorage', () => {
      service.saveDraft(mockConfig);
      const raw = storageStore[STORAGE_KEY];
      expect(raw).toBeDefined();
      const parsed: StoredDraft = JSON.parse(raw);
      expect(parsed.schemaVersion).toBeDefined();
      expect(parsed.savedAt).toBeDefined();
      expect(parsed.config.protocolId).toBe('PRT-001');
    });

    it('should not throw when localStorage throws QuotaExceededError', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => service.saveDraft(mockConfig)).not.toThrow();
    });
  });

  describe('loadDraft()', () => {
    it('should return null when storage is empty', () => {
      expect(service.loadDraft()).toBeNull();
    });

    it('should return the saved draft after saveDraft()', () => {
      service.saveDraft(mockConfig);
      const result = service.loadDraft();
      expect(result).not.toBeNull();
      expect(result!.config.protocolId).toBe('PRT-001');
    });

    it('should return null for malformed JSON in storage', () => {
      storageStore[STORAGE_KEY] = 'not-json';
      expect(service.loadDraft()).toBeNull();
    });
  });

  describe('clearDraft()', () => {
    it('should remove the key from localStorage', () => {
      service.saveDraft(mockConfig);
      expect(service.hasDraft()).toBe(true);
      service.clearDraft();
      expect(service.hasDraft()).toBe(false);
    });
  });

  describe('hasDraft()', () => {
    it('should return false when no draft is stored', () => {
      expect(service.hasDraft()).toBe(false);
    });

    it('should return true after a draft is saved', () => {
      service.saveDraft(mockConfig);
      expect(service.hasDraft()).toBe(true);
    });
  });

  describe('server-side rendering (non-browser)', () => {
    it('should not access localStorage on the server platform', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [ConfigStorageService, { provide: PLATFORM_ID, useValue: 'server' }]
      });
      const serverService = TestBed.inject(ConfigStorageService);
      expect(() => serverService.saveDraft(mockConfig)).not.toThrow();
      expect(serverService.loadDraft()).toBeNull();
      expect(serverService.hasDraft()).toBe(false);
      expect(() => serverService.clearDraft()).not.toThrow();
    });
  });
});
