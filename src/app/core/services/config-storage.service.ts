import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { APP_VERSION } from '../../../environments/version';

export const STORAGE_KEY = 'crg_draft_config';

export interface StoredDraft {
  schemaVersion: string;
  savedAt: string;
  config: DraftConfig;
}

export interface DraftConfig {
  protocolId: string;
  studyName: string;
  phase: string;
  arms: { id: string; name: string; ratio: number }[];
  strata: { id: string; name: string; levelsStr: string }[];
  sitesStr: string;
  blockSizesStr: string;
  stratumCaps: { levels: string[]; cap: number }[];
  seed: string;
  subjectIdMask: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigStorageService {
  private readonly platformId = inject(PLATFORM_ID);

  /** Persists the given form value to localStorage. Silently handles QuotaExceededError. */
  saveDraft(config: DraftConfig): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const draft: StoredDraft = {
        schemaVersion: APP_VERSION,
        savedAt: new Date().toISOString(),
        config
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // QuotaExceededError or other storage errors — silently ignore
    }
  }

  /** Returns the stored draft if present, or null. */
  loadDraft(): StoredDraft | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredDraft;
    } catch {
      return null;
    }
  }

  /** Removes the stored draft from localStorage. */
  clearDraft(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Returns true if a draft exists in localStorage. */
  hasDraft(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return localStorage.getItem(STORAGE_KEY) !== null;
  }
}
