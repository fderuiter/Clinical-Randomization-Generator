import { Injectable, signal } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { RandomizationConfig, GeneratedSchema } from '../core/models/randomization.model';

export interface StudyVersion {
  id: string;
  versionNumber: string; // e.g. "v1.0.0"
  timestamp: string; // ISO string
  operatorId: string;
  reasonForChange: string;
  config: RandomizationConfig;
  schemaHash: string; // SHA-256 hash
  diffHumanReadable: string[];
}

@Injectable({ providedIn: 'root' })
export class VersionHistoryService {
  private dbPromise: Promise<IDBPDatabase>;
  readonly versions = signal<StudyVersion[]>([]);
  readonly isStorageNearLimit = signal<boolean>(false);
  readonly configToRestore = signal<RandomizationConfig | null>(null);

  constructor() {
    this.dbPromise = openDB('EquiposeVersionsDB', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('versions')) {
          db.createObjectStore('versions', { keyPath: 'id' });
        }
      },
    });
    this.loadVersions();
    this.checkStorage();
  }

  private async loadVersions() {
    const db = await this.dbPromise;
    const allVersions = await db.getAll('versions');
    // Sort by timestamp descending
    allVersions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    this.versions.set(allVersions);
  }

  private async checkStorage() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage && estimate.quota) {
        // Warn if > 50MB
        if (estimate.usage > 50 * 1024 * 1024) {
          this.isStorageNearLimit.set(true);
        }
      }
    }
  }

  async saveVersion(
    operatorId: string,
    reasonForChange: string,
    config: RandomizationConfig,
    schemaHash: string,
    diffHumanReadable: string[]
  ): Promise<StudyVersion> {
    const db = await this.dbPromise;
    const allVersions = await db.getAll('versions');
    const newVersionNum = `v1.0.${allVersions.length}`;
    
    const newVersion: StudyVersion = {
      id: crypto.randomUUID(),
      versionNumber: newVersionNum,
      timestamp: new Date().toISOString(),
      operatorId,
      reasonForChange,
      config,
      schemaHash,
      diffHumanReadable
    };

    await db.put('versions', newVersion);
    await this.loadVersions();
    await this.checkStorage();
    return newVersion;
  }

  async getVersion(id: string): Promise<StudyVersion | undefined> {
    const db = await this.dbPromise;
    return await db.get('versions', id);
  }
}
