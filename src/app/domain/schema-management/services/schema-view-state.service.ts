import { computed, Injectable, signal } from '@angular/core';
import { GeneratedSchema, RandomizationResult } from '../../core/models/randomization.model';

export interface ActiveFilter {
  type: 'site' | 'treatment';
  value: string;
}

/**
 * SchemaViewStateService
 *
 * Centralized reactive state layer shared between the analytics dashboard and
 * the results grid.  It holds:
 *   - `isUnblinded`    — blinding toggle
 *   - `activeFilter`   — optional chart-driven cross-filter
 *   - `filteredSchema` — immutable projection of the raw schema through the
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

  /**
   * Reactive projection of the master schema through `activeFilter`.
   * Downstream components (grid, charts) bind exclusively to this signal.
   */
  readonly filteredSchema = computed<GeneratedSchema[]>(() => {
    const result = this._results();
    if (!result) return [];

    const filter = this.activeFilter();
    if (!filter) return result.schema;

    return result.schema.filter(row => {
      if (filter.type === 'site') return row.site === filter.value;
      if (filter.type === 'treatment') return row.treatmentArm === filter.value;
      return true;
    });
  });

  /** Total item count of the filtered dataset. */
  readonly filteredCount = computed(() => this.filteredSchema().length);

  // ---------------------------------------------------------------------------
  // Mutators
  // ---------------------------------------------------------------------------

  /** Called when new randomization results are available. Resets active filter. */
  syncResults(results: RandomizationResult | null): void {
    this._results.set(results);
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
