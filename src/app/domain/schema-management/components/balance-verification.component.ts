import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { BIOSTAT_DATA_ADAPTER } from '../adapters/biostat-data-adapter';
import { BIOSTAT_VALIDATION_ADAPTER, CategoryTarget } from '../adapters/biostat-validation-adapter';
import { TrialRecord } from '../adapters/trial-record.model';

// ---------------------------------------------------------------------------
// Data model for the aggregation engine
// ---------------------------------------------------------------------------

export interface CategoryBalance {
  category: CategoryTarget;
  actual: number;
  target: number;
  variance: number;
  /** 0 = perfect, 1 = expected (incomplete block), 2 = critical error */
  status: 0 | 1 | 2;
}

export interface BalanceRow {
  label: string;
  total: number;
  categories: CategoryBalance[];
}

export interface MarginalBalanceRow {
  factor: string;
  level: string;
  total: number;
  categoryCounts: { name: string; actual: number; target: number }[];
}

// ---------------------------------------------------------------------------

@Component({
  selector: 'app-balance-verification',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (adapter.records().length > 0) {
      <div class="space-y-6">

        <!-- ── Legend ─────────────────────────────────────────────────── -->
        <div class="flex flex-wrap items-center gap-4 text-xs text-muted">
          <span class="font-semibold text-gray-700 dark:text-slate-300">Legend:</span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-full bg-emerald-500"></span>
            Perfect balance
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-full bg-amber-400"></span>
            @if (validation.isMarginalBalanceTarget()) { Expected marginal deviation } @else { Expected deviation (incomplete block) }
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-full bg-red-500"></span>
            Critical error - investigate
          </span>
          <span class="ml-auto text-muted italic">
            Cells show: Actual&nbsp;/&nbsp;Target
          </span>
        </div>

        <!-- ── Global Balance ─────────────────────────────────────────── -->
        <section class="bg-surface rounded-xl shadow-sm border border-border-subtle overflow-hidden">
          <div class="px-6 py-4 border-b border-border-subtle">
            <h3 class="text-sm font-semibold text-main">Global Balance</h3>
            <p class="text-xs text-muted mt-0.5">
              Aggregate distribution across the entire trial (N&nbsp;=&nbsp;{{ globalRow().total }})
            </p>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-subtle/50 text-xs font-semibold text-muted uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-3 text-left">Scope</th>
                  <th class="px-6 py-3 text-right">N</th>
                  @for (ab of globalRow().categories; track ab.category.id) {
                    <th class="px-6 py-3 text-right">{{ ab.category.name }}</th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                <tr>
                  <td class="px-6 py-3 font-medium text-main">All Sites</td>
                  <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">{{ globalRow().total }}</td>
                  @for (ab of globalRow().categories; track ab.category.id) {
                    <td class="px-6 py-3 text-right tabular-nums"
                        [class]="cellClass(ab.status)"
                        [title]="validation.getDeviationTooltip(ab.status, ab.variance, ab.category.name)">
                      {{ ab.actual }}&nbsp;/&nbsp;{{ ab.target | number:'1.0-2' }}
                      @if (ab.status === 0) { <span class="ml-1">✓</span> }
                      @if (ab.status === 1) { <span class="ml-1">⚠</span> }
                      @if (ab.status === 2) { <span class="ml-1" title="Critical error">✕</span> }
                    </td>
                  }
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ── Per-Site Balance ───────────────────────────────────────── -->
        @if (siteRows().length > 0) {
          <section class="bg-surface rounded-xl shadow-sm border border-border-subtle overflow-hidden">
            <div class="px-6 py-4 border-b border-border-subtle">
              <h3 class="text-sm font-semibold text-main">Balance by Site</h3>
              <p class="text-xs text-muted mt-0.5">
                Marginal distribution per clinical site
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-subtle/50 text-xs font-semibold text-muted uppercase tracking-wider">
                  <tr>
                    <th class="px-6 py-3 text-left">Site</th>
                    <th class="px-6 py-3 text-right">N</th>
                    @for (ab of siteRows()[0].categories; track ab.category.id) {
                      <th class="px-6 py-3 text-right">{{ ab.category.name }}</th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                  @for (row of siteRows(); track row.label) {
                    <tr class="hover:bg-hover/30">
                      <td class="px-6 py-3 font-medium text-main">{{ row.label }}</td>
                      <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">{{ row.total }}</td>
                      @for (ab of row.categories; track ab.category.id) {
                        <td class="px-6 py-3 text-right tabular-nums"
                            [class]="cellClass(ab.status)"
                            [title]="validation.getDeviationTooltip(ab.status, ab.variance, ab.category.name)">
                          {{ ab.actual }}&nbsp;/&nbsp;{{ ab.target | number:'1.0-2' }}
                          @if (ab.status === 0) { <span class="ml-1">✓</span> }
                          @if (ab.status === 1) { <span class="ml-1">⚠</span> }
                          @if (ab.status === 2) { <span class="ml-1" title="Critical error">✕</span> }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- ── Minimization: Marginal Balance by Factor/Level ─────────── -->
        @if (validation.isMarginalBalanceTarget() && marginalBalanceRows().length > 0) {
          <section class="bg-surface rounded-xl shadow-sm border border-purple-100 dark:border-purple-800 overflow-hidden">
            <div class="px-6 py-4 border-b border-purple-100 dark:border-purple-800">
              <h3 class="text-sm font-semibold text-main">Marginal Balance by Factor Level</h3>
              <p class="text-xs text-muted mt-0.5">
                Category distribution per stratification factor level (target: equal marginal totals)
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-purple-50 dark:bg-purple-900/30 text-xs font-semibold text-muted uppercase tracking-wider">
                  <tr>
                    <th class="px-6 py-3 text-left">Factor</th>
                    <th class="px-6 py-3 text-left">Level</th>
                    <th class="px-6 py-3 text-right">N</th>
                    @for (row of marginalBalanceRows().slice(0, 1); track row.factor) {
                      @for (ac of row.categoryCounts; track ac.name) {
                        <th class="px-6 py-3 text-right">{{ ac.name }}</th>
                      }
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                  @for (row of marginalBalanceRows(); track row.factor + row.level) {
                    <tr class="hover:bg-hover/30">
                      <td class="px-6 py-3 font-medium text-main text-xs">{{ row.factor }}</td>
                      <td class="px-6 py-3 text-gray-700 dark:text-slate-300">{{ row.level }}</td>
                      <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">{{ row.total }}</td>
                      @for (ac of row.categoryCounts; track ac.name) {
                        <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">
                          {{ ac.actual }}&nbsp;/&nbsp;{{ ac.target | number:'1.0-1' }}
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- ── Per-Stratum Balance ────────────────────────────────────── -->
        @if (!validation.isMarginalBalanceTarget() && stratumRows().length > 0) {
          <section class="bg-surface rounded-xl shadow-sm border border-border-subtle overflow-hidden">
            <div class="px-6 py-4 border-b border-border-subtle">
              <h3 class="text-sm font-semibold text-main">Balance by Stratum</h3>
              <p class="text-xs text-muted mt-0.5">
                Marginal distribution per unique stratification-factor combination
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-subtle/50 text-xs font-semibold text-muted uppercase tracking-wider">
                  <tr>
                    <th class="px-6 py-3 text-left">Stratum</th>
                    <th class="px-6 py-3 text-right">N</th>
                    @for (ab of stratumRows()[0].categories; track ab.category.id) {
                      <th class="px-6 py-3 text-right">{{ ab.category.name }}</th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                  @for (row of stratumRows(); track row.label) {
                    <tr class="hover:bg-hover/30">
                      <td class="px-6 py-3 font-medium text-main max-w-xs truncate" [title]="row.label">{{ row.label }}</td>
                      <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">{{ row.total }}</td>
                      @for (ab of row.categories; track ab.category.id) {
                        <td class="px-6 py-3 text-right tabular-nums"
                            [class]="cellClass(ab.status)"
                            [title]="validation.getDeviationTooltip(ab.status, ab.variance, ab.category.name)">
                          {{ ab.actual }}&nbsp;/&nbsp;{{ ab.target | number:'1.0-2' }}
                          @if (ab.status === 0) { <span class="ml-1">✓</span> }
                          @if (ab.status === 1) { <span class="ml-1">⚠</span> }
                          @if (ab.status === 2) { <span class="ml-1" title="Critical error">✕</span> }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- Footnote -->
        <p class="text-xs text-muted pb-2">
          @if (validation.isMarginalBalanceTarget()) {
            ⚠&nbsp;Minimization (Pocock-Simon) achieves marginal balance across factor levels rather than perfect block-level balance.
            Small deviations from exact equal allocation are expected due to stochastic assignment and covariate sampling.
          } @else {
            ⚠&nbsp;Expected deviations arise when a stratum's total enrollment is not a perfect multiple of the block size,
            causing an incomplete final block. This is mathematically normal and does not indicate an algorithmic error.
          }
        </p>

      </div>
    } @else {
      <div class="text-center py-12 text-muted text-sm">
        Generate a schema first to view the balance verification report.
      </div>
    }
  `,
})
export class BalanceVerificationComponent {
  protected readonly adapter = inject(BIOSTAT_DATA_ADAPTER);
  protected readonly validation = inject(BIOSTAT_VALIDATION_ADAPTER);

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Sum of all category ratios (e.g. 2:1 → 3). */
  private readonly totalRatio = computed<number>(() =>
    this.validation.targets().reduce((sum, a) => sum + a.ratio, 0)
  );

  // ── Core aggregation helper ───────────────────────────────────────────────

  private buildCategoryBalances(rows: TrialRecord[]): CategoryBalance[] {
    const targets = this.validation.targets();
    const totalRatio = this.totalRatio();
    const n = rows.length;

    const actualMap = new Map<string, number>();
    for (const row of rows) {
      actualMap.set(row.category, (actualMap.get(row.category) ?? 0) + 1);
    }

    return targets.map(category => {
      const actual = actualMap.get(category.name) ?? 0;
      const target = totalRatio > 0 ? (category.ratio / totalRatio) * n : 0;
      const variance = actual - target;
      
      const { status } = this.validation.calculateDeviationStatus(variance);

      return { category, actual, target, variance, status };
    });
  }

  // ── Computed signal: global aggregation ──────────────────────────────────

  readonly globalRow = computed<BalanceRow>(() => {
    const records = this.adapter.records();
    return {
      label: 'All Sites',
      total: records.length,
      categories: this.buildCategoryBalances(records),
    };
  });

  // ── Computed signal: per-site aggregation ────────────────────────────────

  readonly siteRows = computed<BalanceRow[]>(() => {
    const records = this.adapter.records();
    const grouped = new Map<string, TrialRecord[]>();
    for (const row of records) {
      if (!grouped.has(row.groupingFactor)) grouped.set(row.groupingFactor, []);
      grouped.get(row.groupingFactor)!.push(row);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([site, rows]) => ({
        label: site,
        total: rows.length,
        categories: this.buildCategoryBalances(rows),
      }));
  });

  // ── Computed signal: per-stratum aggregation ─────────────────────────────

  readonly stratumRows = computed<BalanceRow[]>(() => {
    const records = this.adapter.records();
    const factors = this.adapter.factors();
    if (records.length === 0 || factors.length === 0) return [];

    const grouped = new Map<string, TrialRecord[]>();
    for (const row of records) {
      const parts = [row.groupingFactor, ...factors.map(s => `${s.name || s.id}=${row.stratum[s.id] ?? '?'}`)];
      const key = parts.join(' | ');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, rows]) => ({
        label,
        total: rows.length,
        categories: this.buildCategoryBalances(rows),
      }));
  });

  // ── Computed signal: minimization marginal balance ────────────────────────

  readonly marginalBalanceRows = computed<MarginalBalanceRow[]>(() => {
    if (!this.validation.isMarginalBalanceTarget()) return [];

    const records = this.adapter.records();
    const factors = this.adapter.factors();
    const targets = this.validation.targets();
    const totalRatio = this.totalRatio();

    // Single-pass aggregation: nested Maps keyed by factorId → levelValue → categoryName.
    const countsByFactor = new Map<string, Map<string, { total: number; categoryCounts: Map<string, number> }>>();

    for (const row of records) {
      for (const factor of factors) {
        const level = row.stratum[factor.id];
        if (level == null) continue;

        let levelsForFactor = countsByFactor.get(factor.id);
        if (!levelsForFactor) {
          levelsForFactor = new Map<string, { total: number; categoryCounts: Map<string, number> }>();
          countsByFactor.set(factor.id, levelsForFactor);
        }

        let aggregate = levelsForFactor.get(level);
        if (!aggregate) {
          aggregate = { total: 0, categoryCounts: new Map<string, number>() };
          levelsForFactor.set(level, aggregate);
        }

        aggregate.total += 1;
        aggregate.categoryCounts.set(row.category, (aggregate.categoryCounts.get(row.category) ?? 0) + 1);
      }
    }

    return factors.flatMap(factor =>
      factor.levels.map(level => {
        const aggregate = countsByFactor.get(factor.id)?.get(level);
        const total = aggregate?.total ?? 0;
        const categoryCounts = aggregate?.categoryCounts ?? new Map<string, number>();
        return {
          factor: factor.name || factor.id,
          level,
          total,
          categoryCounts: targets.map(target => ({
            name: target.name,
            actual: categoryCounts.get(target.name) ?? 0,
            target: totalRatio > 0 ? (target.ratio / totalRatio) * total : 0
          }))
        };
      })
    );
  });

  // ── Template helpers ──────────────────────────────────────────────────────

  cellClass(status: 0 | 1 | 2): string {
    switch (status) {
      case 0: return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300';
      case 1: return 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300';
      case 2: return 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      default: return '';
    }
  }
}
