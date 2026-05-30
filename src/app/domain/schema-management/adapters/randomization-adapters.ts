import { computed, inject, Injectable } from '@angular/core';
import { BiostatDataAdapter, ActiveFilter } from './biostat-data-adapter';
import { BiostatValidationAdapter, CategoryTarget, DeviationStatus } from './biostat-validation-adapter';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { SchemaViewStateService } from '../services/schema-view-state.service';
import { TrialRecord } from './trial-record.model';

@Injectable({ providedIn: 'root' })
export class RandomizationDataAdapter implements BiostatDataAdapter {
  private readonly state = inject(RandomizationEngineFacade);
  private readonly viewState = inject(SchemaViewStateService);

  readonly isUnblinded = this.viewState.isUnblinded;

  readonly activeFilter = computed(() => {
    const filter = this.viewState.activeFilter();
    if (!filter) return null;
    return { type: filter.type === 'site' ? 'groupingFactor' : 'category', value: filter.value };
  });

  readonly factors = computed(() => {
    return this.state.results()?.metadata.strata ?? [];
  });

  readonly records = computed<TrialRecord[]>(() => {
    const result = this.state.results();
    if (!result) return [];
    return result.schema.map(r => ({
      id: r.subjectId,
      groupingFactor: r.site,
      stratum: r.stratum,
      category: r.treatmentArm,
      categoryId: r.treatmentArmId,
      blockNumber: r.blockNumber,
      blockSize: r.blockSize,
      stratumCode: r.stratumCode
    }));
  });

  readonly filteredRecords = computed<TrialRecord[]>(() => {
    const records = this.records();
    const filter = this.activeFilter();
    if (!filter) return records;
    return records.filter(r => {
      if (filter.type === 'groupingFactor') return r.groupingFactor === filter.value;
      if (filter.type === 'category') return r.category === filter.value;
      return true;
    });
  });

  readonly metadata = computed(() => {
    return this.state.results()?.metadata || null;
  });

  setFilter(filter: ActiveFilter | null): void {
    if (!filter) {
      this.viewState.setFilter(null);
    } else {
      this.viewState.setFilter({ type: filter.type === 'groupingFactor' ? 'site' : 'treatment', value: filter.value });
    }
  }

  clearFilter(): void {
    this.viewState.clearFilter();
  }

  toggleBlinding(): void {
    this.viewState.toggleBlinding();
  }
}

@Injectable({ providedIn: 'root' })
export class RandomizationValidationAdapter implements BiostatValidationAdapter {
  private readonly state = inject(RandomizationEngineFacade);

  readonly isMarginalBalanceTarget = computed(() =>
    this.state.results()?.metadata.config?.randomizationMethod === 'MINIMIZATION'
  );

  readonly targets = computed<CategoryTarget[]>(() => {
    return this.state.results()?.metadata.config?.arms ?? [];
  });

  private maxBlockSize = computed<number>(() => {
    const config = this.state.results()?.metadata.config;
    if (this.isMarginalBalanceTarget()) return Infinity;
    if (!config?.blockSizes?.length) return 0;
    return Math.max(...config.blockSizes);
  });

  calculateDeviationStatus(variance: number): DeviationStatus {
    const absVariance = Math.abs(variance);
    const maxBlock = this.maxBlockSize();
    let status: 0 | 1 | 2;
    if (absVariance === 0) {
      status = 0;
    } else if (maxBlock > 0 && absVariance < maxBlock) {
      status = 1;
    } else {
      status = 2;
    }
    return { status, variance };
  }

  getDeviationTooltip(status: 0 | 1 | 2, variance: number, categoryName: string): string {
    const isMin = this.isMarginalBalanceTarget();
    switch (status) {
      case 0:
        return `${categoryName}: Perfect balance.`;
      case 1:
        return isMin
          ? `${categoryName}: Expected marginal deviation (Δ = ${variance > 0 ? '+' : ''}${variance.toFixed(1)}). Minimization achieves marginal rather than exact balance; small deviations are normal.`
          : `${categoryName}: Expected deviation (Δ = ${variance > 0 ? '+' : ''}${variance.toFixed(1)}). The total enrollment for this stratum is not a perfect multiple of the block size, resulting in an incomplete final block.`;
      case 2:
        return `${categoryName}: Critical error! Deviation Δ = ${variance > 0 ? '+' : ''}${variance.toFixed(1)} exceeds the maximum expected for a single incomplete block. Investigate the randomization algorithm.`;
      default:
        return '';
    }
  }
}
