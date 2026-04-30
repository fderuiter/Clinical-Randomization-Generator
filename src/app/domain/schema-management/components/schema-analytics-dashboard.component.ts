import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
} from '@angular/core';
import * as echarts from 'echarts/core';
import { PieChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { SchemaViewStateService } from '../services/schema-view-state.service';

// Register only the ECharts modules we need (tree-shakeable).
echarts.use([PieChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const BLINDED_COLOUR = '#94a3b8'; // slate-400

@Component({
  selector: 'app-schema-analytics-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.results()) {
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-4">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-slate-100">Schema Analytics</h3>

          <!-- Active filter HUD -->
          @if (viewState.activeFilter()) {
            <div class="flex items-center gap-2 text-sm">
              <span class="text-gray-500 dark:text-slate-400">Active filter:</span>
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 font-medium text-xs">
                {{ viewState.activeFilter()!.type === 'site' ? 'Site' : 'Treatment' }}:
                {{ viewState.activeFilter()!.value }}
                <button
                  (click)="viewState.clearFilter()"
                  class="ml-1 hover:text-indigo-600 dark:hover:text-indigo-200 leading-none rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Remove filter"
                  title="Remove filter"
                >✕</button>
              </span>
              <button
                (click)="viewState.clearFilter()"
                class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >Clear all filters</button>
            </div>
          }
        </div>

        <!-- Charts grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Donut chart: Treatment Balance -->
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Treatment Balance
              @if (!viewState.isUnblinded()) {
                <span class="ml-1 text-amber-700 dark:text-amber-400">(blinded)</span>
              }
            </p>
            <div #donutContainer class="h-56 w-full"></div>
          </div>

          <!-- Bar chart: Site Distribution -->
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Distribution by Site
            </p>
            <div #barContainer class="h-56 w-full"></div>
          </div>
        </div>

        <p class="text-xs text-gray-600 dark:text-slate-400">
          Click a chart segment or bar to cross-filter the results grid below.
        </p>
      </div>
    }
  `,
})
export class SchemaAnalyticsDashboardComponent implements OnDestroy {
  protected readonly state = inject(RandomizationEngineFacade);
  protected readonly viewState = inject(SchemaViewStateService);

  private readonly donutContainerRef = viewChild<ElementRef<HTMLDivElement>>('donutContainer');
  private readonly barContainerRef = viewChild<ElementRef<HTMLDivElement>>('barContainer');

  private donutChart: echarts.ECharts | null = null;
  private barChart: echarts.ECharts | null = null;

  // -------------------------------------------------------------------------
  // Derived data for charts
  // -------------------------------------------------------------------------

  /** Aggregated treatment counts from the filtered schema. */
  private readonly treatmentCounts = computed(() => {
    const schema = this.viewState.filteredSchema();
    const map = new Map<string, number>();
    for (const row of schema) {
      map.set(row.treatmentArm, (map.get(row.treatmentArm) ?? 0) + 1);
    }
    return map;
  });

  /** Aggregated site counts from the filtered schema. */
  private readonly siteCounts = computed(() => {
    const schema = this.viewState.filteredSchema();
    const map = new Map<string, number>();
    for (const row of schema) {
      map.set(row.site, (map.get(row.site) ?? 0) + 1);
    }
    return map;
  });

  /** ECharts option object for the donut chart (reacts to blinding state). */
  private readonly donutOption = computed(() => {
    const isUnblinded = this.viewState.isUnblinded();
    const counts = this.treatmentCounts();

    if (!isUnblinded) {
      // Blinded: solid monochromatic ring, no treatment info leaked
      return {
        tooltip: { show: false },
        legend: { show: false },
        series: [{
          type: 'pie',
          radius: ['45%', '70%'],
          label: { show: true, formatter: 'Blinded', position: 'center', fontSize: 13, color: BLINDED_COLOUR, fontWeight: 'bold' },
          emphasis: { disabled: true },
          data: [{ value: 1, name: 'Blinded', itemStyle: { color: BLINDED_COLOUR } }],
        }],
      };
    }

    const palette = ['#6366f1', '#34d399', '#fb923c', '#f472b6', '#38bdf8', '#a78bfa'];
    const data = Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      itemStyle: { color: palette[i % palette.length] },
    }));

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'horizontal', bottom: 0, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } },
        data,
      }],
    };
  });

  /** ECharts option object for the grouped bar chart. */
  private readonly barOption = computed(() => {
    const schema = this.viewState.filteredSchema();
    const isUnblinded = this.viewState.isUnblinded();

    // Collect unique sites and treatment arms
    const sites = [...new Set(schema.map(r => r.site))].sort();
    const arms = isUnblinded
      ? [...new Set(schema.map(r => r.treatmentArm))].sort()
      : ['Total'];

    // Build series data
    const series = arms.map((arm, i) => {
      const palette = ['#6366f1', '#34d399', '#fb923c', '#f472b6', '#38bdf8', '#a78bfa'];
      const data = sites.map(site => {
        if (!isUnblinded) {
          return schema.filter(r => r.site === site).length;
        }
        return schema.filter(r => r.site === site && r.treatmentArm === arm).length;
      });
      return {
        name: arm,
        type: 'bar' as const,
        data,
        itemStyle: { color: isUnblinded ? palette[i % palette.length] : BLINDED_COLOUR },
      };
    });

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: isUnblinded ? { bottom: 0, textStyle: { fontSize: 11 } } : { show: false },
      grid: { left: '3%', right: '4%', bottom: isUnblinded ? '18%' : '5%', containLabel: true },
      xAxis: { type: 'category', data: sites, axisLabel: { rotate: sites.length > 5 ? 30 : 0, fontSize: 11 } },
      yAxis: { type: 'value', minInterval: 1 },
      series,
    };
  });

  // -------------------------------------------------------------------------
  // Chart lifecycle via Angular effects
  // -------------------------------------------------------------------------

  constructor() {
    // Initialize charts once their host elements appear
    effect(() => {
      const donutEl = this.donutContainerRef()?.nativeElement;
      const barEl = this.barContainerRef()?.nativeElement;
      if (!donutEl || !barEl) return;

      if (!this.donutChart) {
        try {
          this.donutChart = echarts.init(donutEl, undefined, { renderer: 'canvas' });
          this.donutChart.on('click', (params: echarts.ECElementEvent) => {
            if (!this.viewState.isUnblinded()) return; // blinded: no interaction
            const name = params.name as string;
            const current = this.viewState.activeFilter();
            if (current?.type === 'treatment' && current.value === name) {
              this.viewState.clearFilter();
            } else {
              this.viewState.setFilter({ type: 'treatment', value: name });
            }
          });
        } catch {
          // Canvas not fully supported (e.g., SSR or test environments).
          return;
        }
      }

      if (!this.barChart) {
        try {
          this.barChart = echarts.init(barEl, undefined, { renderer: 'canvas' });
          this.barChart.on('click', (params: echarts.ECElementEvent) => {
            // params.name holds the category (site) in a bar chart
            const siteName = params.name as string;
            const current = this.viewState.activeFilter();
            if (current?.type === 'site' && current.value === siteName) {
              this.viewState.clearFilter();
            } else {
              this.viewState.setFilter({ type: 'site', value: siteName });
            }
          });
        } catch {
          // Canvas not fully supported (e.g., SSR or test environments).
          return;
        }
      }

      // Apply latest options (triggers smooth animation)
      try {
        this.donutChart?.setOption(this.donutOption(), { notMerge: true });
        this.barChart?.setOption(this.barOption(), { notMerge: true });
      } catch {
        // Canvas rendering errors (e.g., in test environments).
      }
    });

    // Resize charts when window resizes
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize);
    }
  }

  ngOnDestroy(): void {
    try { this.donutChart?.dispose(); } catch { /* ignore */ }
    try { this.barChart?.dispose(); } catch { /* ignore */ }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
    }
  }

  private readonly onResize = (): void => {
    this.donutChart?.resize();
    this.barChart?.resize();
  };
}
