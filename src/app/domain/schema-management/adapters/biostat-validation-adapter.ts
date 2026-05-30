import { InjectionToken, Signal } from '@angular/core';

export interface CategoryTarget {
  id: string;
  name: string;
  ratio: number;
}

export interface DeviationStatus {
  status: 0 | 1 | 2;
  variance: number;
}

export interface BiostatValidationAdapter {
  readonly isMarginalBalanceTarget: Signal<boolean>;
  readonly targets: Signal<CategoryTarget[]>;

  calculateDeviationStatus(variance: number): DeviationStatus;
  getDeviationTooltip(status: 0 | 1 | 2, variance: number, categoryName: string): string;
}

export const BIOSTAT_VALIDATION_ADAPTER = new InjectionToken<BiostatValidationAdapter>('BIOSTAT_VALIDATION_ADAPTER');
