import { InjectionToken, Signal } from '@angular/core';
import { TrialRecord } from './trial-record.model';

export interface ActiveFilter {
  type: string;
  value: string;
}

export interface BiostatDataAdapter {
  readonly isUnblinded: Signal<boolean>;
  readonly activeFilter: Signal<ActiveFilter | null>;
  readonly records: Signal<TrialRecord[]>;
  readonly filteredRecords: Signal<TrialRecord[]>;
  readonly factors: Signal<{ id: string, name: string, levels: string[] }[]>;
  readonly metadata: Signal<any>;
  
  setFilter(filter: ActiveFilter | null): void;
  clearFilter(): void;
  toggleBlinding(): void;
}

export const BIOSTAT_DATA_ADAPTER = new InjectionToken<BiostatDataAdapter>('BIOSTAT_DATA_ADAPTER');
