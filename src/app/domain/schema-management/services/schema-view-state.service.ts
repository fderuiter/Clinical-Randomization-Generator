import { computed, Injectable, signal } from '@angular/core';
import { GeneratedSchema, RandomizationResult } from '../../core/models/randomization.model';
import { AdamLiteDataset } from '../../core/models/adam-lite.model';
import { AdamLiteMapper } from './adam-lite.mapper';

export interface ActiveFilter {
  type?: string;       // Legacy tests/components might use this
  variableId?: string; // New ADaM-lite logic uses this
  value: string;
}

/**
 * SchemaViewStateService
 *
 * Centralized reactive state layer shared between the analytics dashboard and
 * the results grid.  It holds:
 *   - `isUnblinded`    - blinding toggle
 *   - `activeFilter`   - optional chart-driven cross-filter
 *   - `filteredSchema` - immutable projection of the raw schema through the
 *                        active filter; the single source of truth for all UI.
 */
@Injectable({ providedIn: 'root' })
export class SchemaViewStateService {
  /** Whether treatment-arm data should be shown in plain text. */
  readonly isUnblinded = signal(false);

  /** Currently active cross-filter (set by clicking a chart element). */
  readonly activeFilter = signal<ActiveFilter | null>(null);

  /** Stable reference to the raw result; updated via syncResults(). */
  private readonly _results = signal<RandomizationResult | null>(null);

  /** Directly injected custom dataset (e.g., demographics) */
  private readonly _customDataset = signal<AdamLiteDataset | null>(null);

  /**
   * The active ADaM-lite dataset (either mapped from randomization results or custom).
   */
  readonly adamDataset = computed<AdamLiteDataset | null>(() => {
    const custom = this._customDataset();
    if (custom) return custom;
    const result = this._results();
    if (!result) return null;
    return AdamLiteMapper.fromRandomizationResult(result);
  });

  /** Filtered ADaM-lite dataset */
  readonly filteredAdamDataset = computed<AdamLiteDataset | null>(() => {
    const dataset = this.adamDataset();
    if (!dataset) return null;

    const filter = this.activeFilter();
    if (!filter) return dataset;

    let key = filter.variableId || filter.type;
    if (!key) return dataset;
    if (key === 'treatment') key = 'treatmentArm';

    const filteredRecords = dataset.records.filter(r => String(r[key!]) === String(filter.value));
    return { ...dataset, records: filteredRecords };
  });

  /**
   * Reactive projection of the master schema through `activeFilter`.
   * Downstream components (grid, charts) bind exclusively to this signal.
   */
  readonly filteredSchema = computed<GeneratedSchema[]>(() => {
    const result = this._results();
    if (!result) return [];

    const filter = this.activeFilter();
    if (!filter) return result.schema;

    const key = filter.variableId || filter.type;
    if (!key) return result.schema;

    return result.schema.filter(row => {
      let val: any;
      if (key === 'site') {
        val = row.site;
      } else if (key === 'treatmentArm' || key === 'treatment') {
        val = row.treatmentArm;
      } else {
        val = (row as any)[key] || (row.stratum && row.stratum[key.replace('stratum_', '')]);
      }
      return String(val) === String(filter.value);
    });
  });

  /** Total item count of the filtered dataset. */
  readonly filteredCount = computed(() => {
    const dataset = this.filteredAdamDataset();
    return dataset ? dataset.records.length : 0;
  });

  // ---------------------------------------------------------------------------
  // Mutators
  // ---------------------------------------------------------------------------

  /** Called when new randomization results are available. Resets active filter. */
  syncResults(results: RandomizationResult | null): void {
    this._customDataset.set(null); // Clear custom dataset
    this._results.set(results);
    this.activeFilter.set(null);
  }

  setAdamDataset(dataset: AdamLiteDataset | null): void {
    this._customDataset.set(dataset);
    this.activeFilter.set(null);
  }

  toggleBlinding(): void {
    this.isUnblinded.update(v => !v);
  }

  setFilter(filter: ActiveFilter | null): void {
    this.activeFilter.set(filter);
  }

  clearFilter(): void {
    this.activeFilter.set(null);
  }
}
