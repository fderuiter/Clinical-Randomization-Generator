# Biostat Adapter Layer Implementation Guide

## Overview
The Biostat Adapter Layer provides a generic interface allowing the reporting and analytics UI components to consume any clinical dataset (e.g., Randomization, Demographics, Adverse Events). The adapter pattern decoupled these components from the legacy `GeneratedSchema` specific to randomization models.

By implementing these adapters, your custom dataset can seamlessly integrate into components such as `SchemaAnalyticsDashboardComponent`, `BalanceVerificationComponent`, and `ResultsGridComponent`, as well as support automatic script export logic (R, SAS, Python).

## Core Interfaces

### 1. `TrialRecord`
To adapt your custom data row, map its attributes to the `TrialRecord` generic model.

```typescript
export interface TrialRecord {
  /** Unique identifier for the subject/row */
  id: string;

  /** The primary categorical variable (e.g., Treatment Arm, Age Group, Severity) */
  category: string;

  /** The primary grouping factor for balance/allocation (e.g., Site, Region, Ward) */
  groupingFactor: string;

  /** Additional dynamic metadata (such as Stratum definitions) */
  stratum?: Record<string, string>;

  // Optional extensions:
  blockSize?: number;
  blockNumber?: number;
  stratumCode?: string;
  treatmentArmId?: string; // Kept for generic fallback references
  [key: string]: string | number | undefined | Record<string, string>;
}
```

### 2. `BiostatDataAdapter`
The core provider token `BIOSTAT_DATA_ADAPTER` expects an implementation of this interface.

```typescript
export interface BiostatDataAdapter {
  /** Indicates whether the view should obfuscate sensitive categorical data */
  readonly isUnblinded: Signal<boolean>;

  /** Currently applied filter applied by the user in the UI */
  readonly activeFilter: Signal<ActiveFilter | null>;

  /** Full array of mapped records */
  readonly records: Signal<TrialRecord[]>;

  /** Filtered array of mapped records */
  readonly filteredRecords: Signal<TrialRecord[]>;

  /** Strata or factors defining cross-sectional data (used for headers and grouping) */
  readonly factors: Signal<StratumFactor[]>;

  /** Generic metadata envelope useful for export generation (e.g., study config, audit hash) */
  readonly metadata: Signal<any>;

  /** Invoked by the UI when a user requests blinding to be toggled */
  toggleBlinding(): void;

  /** Update active column filter */
  setFilter(column: keyof TrialRecord | string, value: string): void;

  /** Clear specific column filter */
  clearFilter(column: keyof TrialRecord | string): void;
}
```

## How to Implement a New Data Adapter

### Step 1: Create the Adapter Class
Create an Angular `@Injectable` class that implements `BiostatDataAdapter`. Use Angular `Signal` and `computed` properties for reactive state management. Ensure you apply the translation logic from your source data model to `TrialRecord`.

```typescript
import { computed, inject, Injectable, signal } from '@angular/core';
import { BiostatDataAdapter, TrialRecord, StratumFactor } from './biostat-data-adapter';
import { DemographicsService } from '../services/demographics.service';

@Injectable()
export class DemographicsDataAdapter implements BiostatDataAdapter {
  private readonly sourceService = inject(DemographicsService);

  public readonly isUnblinded = signal(true); // Demographics usually aren't blinded
  public readonly activeFilter = signal<any>(null);

  // Example Mapping Logic
  public readonly records = computed<TrialRecord[]>(() => {
    const rawData = this.sourceService.getSubjects();
    return rawData.map(subject => ({
      id: subject.subjectId,
      category: subject.ageGroup, // Maps age group as the primary category
      groupingFactor: subject.siteLocation, // Groups by region/site
      stratum: { gender: subject.gender }
    }));
  });

  public readonly filteredRecords = computed(() => {
    // Implement filtering logic based on activeFilter signal
    return this.records();
  });

  public readonly factors = computed<StratumFactor[]>(() => [
    { id: 'gender', name: 'Gender', levels: ['Male', 'Female', 'Other'] }
  ]);

  public readonly metadata = computed(() => ({
    studyName: 'Demographics Study',
    generatedAt: new Date().toISOString()
  }));

  public toggleBlinding(): void {
    // Typically a no-op if blinding is not supported, or toggle the signal
  }

  public setFilter(column: string, value: string): void {
    this.activeFilter.set({ column, value });
  }

  public clearFilter(column: string): void {
    this.activeFilter.set(null);
  }
}
```

### Step 2: Provide the Adapter to the Component Tree
Provide your adapter implementation at the route or component level where the Analytics or Results Grid is used. This overrides the default `RandomizationDataAdapter` injection.

```typescript
import { Component } from '@angular/core';
import { BIOSTAT_DATA_ADAPTER } from './adapters/biostat-data-adapter';
import { DemographicsDataAdapter } from './adapters/demographics-data-adapter';
import { ResultsGridComponent } from './components/results-grid.component';

@Component({
  selector: 'app-demographics-view',
  template: `<app-results-grid></app-results-grid>`,
  standalone: true,
  imports: [ResultsGridComponent],
  providers: [
    { provide: BIOSTAT_DATA_ADAPTER, useClass: DemographicsDataAdapter }
  ]
})
export class DemographicsViewComponent {}
```

## Considerations & Constraints
- **Performance:** Ensure that mapping to `TrialRecord` inside a `computed` function executes quickly (< 50ms overhead for 10k records). Avoid heavy deep clones.
- **UI Neutrality:** The adapter layer must not contain any DOM elements, UI logic, or framework lifecycle hooks like `ngOnInit`.
- **Validation Fallbacks:** If your dataset supports block/balance verification, also implement and provide `BIOSTAT_VALIDATION_ADAPTER`. If validation does not apply to your data context, implement it to always return 100% compliance.
