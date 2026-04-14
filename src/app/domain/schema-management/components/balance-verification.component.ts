import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { GeneratedSchema, TreatmentArm } from '../../core/models/randomization.model';

// ---------------------------------------------------------------------------
// Data model for the aggregation engine
// ---------------------------------------------------------------------------

export interface ArmBalance {
  arm: TreatmentArm;
  actual: number;
  target: number;
  variance: number;
  /** 0 = perfect, 1 = expected (incomplete block), 2 = critical error */
  status: 0 | 1 | 2;
}

export interface BalanceRow {
  label: string;
  total: number;
  arms: ArmBalance[];
}

export interface MarginalBalanceRow {
  factor: string;
  level: string;
  total: number;
  armCounts: { name: string; actual: number; target: number }[];
}

// ---------------------------------------------------------------------------

@Component({
  selector: 'app-balance-verification',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.results(); as result) {
      <div class="space-y-6">

        <!-- ── Legend ─────────────────────────────────────────────────── -->
        <div class="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
          <span class="font-semibold text-gray-700 dark:text-slate-300">Legend:</span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-full bg-emerald-500"></span>
            Perfect balance
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-full bg-amber-400"></span>
            @if (isMinimization()) { Expected marginal deviation } @else { Expected deviation (incomplete block) }
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-full bg-red-500"></span>
            Critical error — investigate
          </span>
          <span class="ml-auto text-gray-400 dark:text-slate-500 italic">
            Cells show: Actual&nbsp;/&nbsp;Target
          </span>
        </div>

        <!-- ── Global Balance ─────────────────────────────────────────── -->
        <section class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-slate-100">Global Balance</h3>
            <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Aggregate distribution across the entire trial (N&nbsp;=&nbsp;{{ globalRow().total }})
            </p>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 dark:bg-slate-900/50 text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-3 text-left">Scope</th>
                  <th class="px-6 py-3 text-right">N</th>
                  @for (ab of globalRow().arms; track ab.arm.id) {
                    <th class="px-6 py-3 text-right">{{ ab.arm.name }}</th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                <tr>
                  <td class="px-6 py-3 font-medium text-gray-900 dark:text-slate-100">All Sites</td>
                  <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">{{ globalRow().total }}</td>
                  @for (ab of globalRow().arms; track ab.arm.id) {
                    <td class="px-6 py-3 text-right tabular-nums"
                        [class]="cellClass(ab.status)"
                        [title]="tooltipText(ab)">
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
          <section class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-slate-100">Balance by Site</h3>
              <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Marginal distribution per clinical site
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-50 dark:bg-slate-900/50 text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th class="px-6 py-3 text-left">Site</th>
                    <th class="px-6 py-3 text-right">N</th>
                    @for (ab of siteRows()[0].arms; track ab.arm.id) {
                      <th class="px-6 py-3 text-right">{{ ab.arm.name }}</th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                  @for (row of siteRows(); track row.label) {
                    <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td class="px-6 py-3 font-medium text-gray-900 dark:text-slate-100">{{ row.label }}</td>
                      <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">{{ row.total }}</td>
                      @for (ab of row.arms; track ab.arm.id) {
                        <td class="px-6 py-3 text-right tabular-nums"
                            [class]="cellClass(ab.status)"
                            [title]="tooltipText(ab)">
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
        @if (isMinimization() && marginalBalanceRows().length > 0) {
          <section class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-purple-100 dark:border-purple-800 overflow-hidden">
            <div class="px-6 py-4 border-b border-purple-100 dark:border-purple-800">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-slate-100">Marginal Balance by Factor Level</h3>
              <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Arm distribution per stratification factor level (Pocock-Simon minimization target: equal marginal totals)
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-purple-50 dark:bg-purple-900/30 text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th class="px-6 py-3 text-left">Factor</th>
                    <th class="px-6 py-3 text-left">Level</th>
                    <th class="px-6 py-3 text-right">N</th>
                    @for (row of marginalBalanceRows().slice(0, 1); track row.factor) {
                      @for (ac of row.armCounts; track ac.name) {
                        <th class="px-6 py-3 text-right">{{ ac.name }}</th>
                      }
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                  @for (row of marginalBalanceRows(); track row.factor + row.level) {
                    <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td class="px-6 py-3 font-medium text-gray-900 dark:text-slate-100 text-xs">{{ row.factor }}</td>
                      <td class="px-6 py-3 text-gray-700 dark:text-slate-300">{{ row.level }}</td>
                      <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">{{ row.total }}</td>
                      @for (ac of row.armCounts; track ac.name) {
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
        @if (!isMinimization() && stratumRows().length > 0) {
          <section class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-slate-100">Balance by Stratum</h3>
              <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Marginal distribution per unique stratification-factor combination
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-50 dark:bg-slate-900/50 text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th class="px-6 py-3 text-left">Stratum</th>
                    <th class="px-6 py-3 text-right">N</th>
                    @for (ab of stratumRows()[0].arms; track ab.arm.id) {
                      <th class="px-6 py-3 text-right">{{ ab.arm.name }}</th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                  @for (row of stratumRows(); track row.label) {
                    <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td class="px-6 py-3 font-medium text-gray-900 dark:text-slate-100 max-w-xs truncate" [title]="row.label">{{ row.label }}</td>
                      <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">{{ row.total }}</td>
                      @for (ab of row.arms; track ab.arm.id) {
                        <td class="px-6 py-3 text-right tabular-nums"
                            [class]="cellClass(ab.status)"
                            [title]="tooltipText(ab)">
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
        <p class="text-xs text-gray-400 dark:text-slate-500 pb-2">
          @if (isMinimization()) {
            ⚠&nbsp;Minimization (Pocock-Simon) achieves marginal balance across factor levels rather than perfect block-level balance.
            Small deviations from exact equal allocation are expected due to stochastic assignment and covariate sampling.
          } @else {
            ⚠&nbsp;Expected deviations arise when a stratum's total enrollment is not a perfect multiple of the block size,
            causing an incomplete final block. This is mathematically normal and does not indicate an algorithmic error.
          }
        </p>

      </div>
    } @else {
      <div class="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">
        Generate a schema first to view the balance verification report.
      </div>
    }
  `,
})
export class BalanceVerificationComponent {
  protected readonly state = inject(RandomizationEngineFacade);

  // ── Helpers ──────────────────────────────────────────────────────────────

  readonly isMinimization = computed(() =>
    this.state.results()?.metadata.config?.randomizationMethod === 'MINIMIZATION'
  );

  /** Maximum block size from the config — used to classify deviations.
   * Returns Infinity for minimization so any non-zero variance is classified
   * as 'expected deviation' (status 1) rather than 'critical error' (status 2),
   * since minimization does not guarantee perfect block-level balance.
   */
  private readonly maxBlockSize = computed<number>(() => {
    const config = this.state.results()?.metadata.config;
    if (this.isMinimization()) return Infinity;
    if (!config?.blockSizes?.length) return 0;
    return Math.max(...config.blockSizes);
  });

  /** All treatment arms from the config. */
  private readonly arms = computed<TreatmentArm[]>(() => {
    return this.state.results()?.metadata.config?.arms ?? [];
  });

  /** Sum of all arm ratios (e.g. 2:1 → 3). */
  private readonly totalRatio = computed<number>(() =>
    this.arms().reduce((sum, a) => sum + a.ratio, 0)
  );

  // ── Core aggregation helper ───────────────────────────────────────────────

  private buildArmBalances(rows: GeneratedSchema[]): ArmBalance[] {
    const arms = this.arms();
    const totalRatio = this.totalRatio();
    const n = rows.length;
    const maxBlock = this.maxBlockSize();

    const actualMap = new Map<string, number>();
    for (const row of rows) {
      actualMap.set(row.treatmentArm, (actualMap.get(row.treatmentArm) ?? 0) + 1);
    }

    return arms.map(arm => {
      const actual = actualMap.get(arm.name) ?? 0;
      const target = totalRatio > 0 ? (arm.ratio / totalRatio) * n : 0;
      const variance = actual - target;
      const absVariance = Math.abs(variance);

      let status: 0 | 1 | 2;
      if (absVariance === 0) {
        status = 0;
      } else if (maxBlock > 0 && absVariance < maxBlock) {
        status = 1;
      } else {
        status = 2;
      }

      return { arm, actual, target, variance, status };
    });
  }

  // ── Computed signal: global aggregation ──────────────────────────────────

  readonly globalRow = computed<BalanceRow>(() => {
    const schema = this.state.results()?.schema ?? [];
    return {
      label: 'All Sites',
      total: schema.length,
      arms: this.buildArmBalances(schema),
    };
  });

  // ── Computed signal: per-site aggregation ────────────────────────────────

  readonly siteRows = computed<BalanceRow[]>(() => {
    const schema = this.state.results()?.schema ?? [];
    const grouped = new Map<string, GeneratedSchema[]>();
    for (const row of schema) {
      if (!grouped.has(row.site)) grouped.set(row.site, []);
      grouped.get(row.site)!.push(row);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([site, rows]) => ({
        label: site,
        total: rows.length,
        arms: this.buildArmBalances(rows),
      }));
  });

  // ── Computed signal: per-stratum aggregation ─────────────────────────────

  readonly stratumRows = computed<BalanceRow[]>(() => {
    const result = this.state.results();
    if (!result) return [];

    const schema = result.schema;
    const strata = result.metadata.strata ?? [];
    if (strata.length === 0) return [];

    const grouped = new Map<string, GeneratedSchema[]>();
    for (const row of schema) {
      const parts = [row.site, ...strata.map(s => `${s.name || s.id}=${row.stratum[s.id] ?? '?'}`)];
      const key = parts.join(' | ');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, rows]) => ({
        label,
        total: rows.length,
        arms: this.buildArmBalances(rows),
      }));
  });

  // ── Computed signal: minimization marginal balance ────────────────────────

  readonly marginalBalanceRows = computed<MarginalBalanceRow[]>(() => {
    const result = this.state.results();
    if (!result || result.metadata.config?.randomizationMethod !== 'MINIMIZATION') return [];

    const schema = result.schema;
    const strata = result.metadata.strata ?? [];
    const arms = result.metadata.config?.arms ?? [];
    const totalRatio = arms.reduce((s, a) => s + a.ratio, 0);

    // Single-pass aggregation: nested Maps keyed by factorId → levelValue → armName.
    const countsByFactor = new Map<string, Map<string, { total: number; armCounts: Map<string, number> }>>();

    for (const row of schema) {
      for (const factor of strata) {
        const level = row.stratum[factor.id];
        if (level == null) continue;

        let levelsForFactor = countsByFactor.get(factor.id);
        if (!levelsForFactor) {
          levelsForFactor = new Map<string, { total: number; armCounts: Map<string, number> }>();
          countsByFactor.set(factor.id, levelsForFactor);
        }

        let aggregate = levelsForFactor.get(level);
        if (!aggregate) {
          aggregate = { total: 0, armCounts: new Map<string, number>() };
          levelsForFactor.set(level, aggregate);
        }

        aggregate.total += 1;
        aggregate.armCounts.set(row.treatmentArm, (aggregate.armCounts.get(row.treatmentArm) ?? 0) + 1);
      }
    }

    return strata.flatMap(factor =>
      factor.levels.map(level => {
        const aggregate = countsByFactor.get(factor.id)?.get(level);
        const total = aggregate?.total ?? 0;
        const armCounts = aggregate?.armCounts ?? new Map<string, number>();
        return {
          factor: factor.name || factor.id,
          level,
          total,
          armCounts: arms.map(arm => ({
            name: arm.name,
            actual: armCounts.get(arm.name) ?? 0,
            target: totalRatio > 0 ? (arm.ratio / totalRatio) * total : 0
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
    }
  }

  tooltipText(ab: ArmBalance): string {
    const isMinimization = this.isMinimization();
    switch (ab.status) {
      case 0:
        return `${ab.arm.name}: Perfect balance. Actual = Target = ${ab.actual}.`;
      case 1:
        return isMinimization
          ? `${ab.arm.name}: Expected marginal deviation (Δ = ${ab.variance > 0 ? '+' : ''}${ab.variance.toFixed(1)}). ` +
            `Minimization achieves marginal rather than exact balance; small deviations are normal.`
          : `${ab.arm.name}: Expected deviation (Δ = ${ab.variance > 0 ? '+' : ''}${ab.variance.toFixed(1)}). ` +
            `The total enrollment for this stratum is not a perfect multiple of the block size, ` +
            `resulting in an incomplete final block.`;
      case 2:
        return `${ab.arm.name}: Critical error! Deviation Δ = ${ab.variance > 0 ? '+' : ''}${ab.variance.toFixed(1)} ` +
          `exceeds the maximum expected for a single incomplete block. Investigate the randomization algorithm.`;
    }
  }
}
