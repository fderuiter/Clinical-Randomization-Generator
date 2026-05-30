import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
  Input,
  Output,
  EventEmitter,
  OnInit,
  SimpleChanges,
  OnChanges
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
import { AdamLiteDataset, AdamLiteVariable } from '../../core/models/adam-lite.model';

// Register only the ECharts modules we need (tree-shakeable).
echarts.use([PieChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

@Component({
  selector: 'app-echart',
  standalone: true,
  template: `<div class="w-full h-full" #container></div>`
})
export class EchartComponent implements OnDestroy, OnInit, OnChanges {
  @Input() option: any;
  @Output() chartClick = new EventEmitter<any>();
  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
  private chart: echarts.ECharts | null = null;

  ngOnInit() {
    this.initChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['option'] && this.chart) {
      try {
        this.chart.setOption(this.option, { notMerge: true });
      } catch {}
    }
  }

  ngAfterViewInit() {
    this.initChart();
  }

  private initChart() {
    const el = this.containerRef()?.nativeElement;
    if (!el || !this.option || this.chart) return;

    try {
      this.chart = echarts.init(el, undefined, { renderer: 'canvas' });
      this.chart.on('click', (params: echarts.ECElementEvent) => {
        this.chartClick.emit(params);
      });
      this.chart.setOption(this.option, { notMerge: true });
    } catch {
      return;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize);
    }
  }

  ngOnDestroy() {
    try { this.chart?.dispose(); } catch {}
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
    }
  }

  private readonly onResize = () => {
    this.chart?.resize();
  };
}

@Component({
  selector: 'app-schema-analytics-dashboard',
  standalone: true,
  imports: [EchartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (viewState.adamDataset()) {
      <div data-testid="schema-analytics-dashboard" class="bg-surface rounded-xl shadow-sm border border-border-subtle p-6 space-y-4">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-main">Schema Analytics</h3>

          <!-- Active filter HUD -->
          @if (viewState.activeFilter()) {
            <div class="flex items-center gap-2 text-sm">
              <span class="text-muted">Active filter:</span>
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 font-medium text-xs">
                {{ getVariableLabel(viewState.activeFilter()!.variableId || viewState.activeFilter()!.type || '') }}:
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
          @for (chart of chartConfigs(); track chart.id) {
            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wider mb-2">
                Distribution by {{ chart.label }}
                @if (chart.isBlinded) {
                  <span class="ml-1 text-amber-700 dark:text-amber-400">(blinded)</span>
                }
              </p>
              <div class="h-56 w-full">
                <app-echart [option]="chart.option" (chartClick)="chart.clickHandler($event)"></app-echart>
              </div>
            </div>
          }
        </div>

        <p class="text-xs text-muted">
          Click a chart segment or bar to cross-filter the results grid below.
        </p>
      </div>
    }
  `,
})
export class SchemaAnalyticsDashboardComponent {
  protected readonly viewState = inject(SchemaViewStateService);

  private getCssColor(token: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    return value || fallback;
  }

  getVariableLabel(id: string): string {
    if (id === 'treatment') id = 'treatmentArm';
    const ds = this.viewState.adamDataset();
    if (!ds) return id;
    const v = ds.variables.find(v => v.id === id);
    return v ? v.label : id;
  }

  readonly chartConfigs = computed(() => {
    const dataset = this.viewState.adamDataset();
    const filteredDataset = this.viewState.filteredAdamDataset();
    if (!dataset || !filteredDataset) return [];

    const isUnblinded = this.viewState.isUnblinded();
    const blindedColour = this.getCssColor('--text-muted', '#94a3b8');
    const palette = ['#6366f1', '#34d399', '#fb923c', '#f472b6', '#38bdf8', '#a78bfa'];

    const categoricalVars = dataset.variables.filter(v => v.type === 'categorical');
    const charts = [];

    for (let i = 0; i < categoricalVars.length; i++) {
      const v = categoricalVars[i];
      const isBlindedGroup = v.metadataTags.includes('Group') && !isUnblinded;

      // Calculate counts from filtered dataset
      const counts = new Map<string, number>();
      for (const row of filteredDataset.records) {
        const val = String(row[v.id]);
        counts.set(val, (counts.get(val) || 0) + 1);
      }

      let option: any;

      if (isBlindedGroup) {
        option = {
          tooltip: { show: false },
          legend: { show: false },
          series: [{
            type: 'pie',
            radius: ['45%', '70%'],
            label: { show: true, formatter: 'Blinded', position: 'center', fontSize: 13, color: blindedColour, fontWeight: 'bold' },
            emphasis: { disabled: true },
            data: [{ value: 1, name: 'Blinded', itemStyle: { color: blindedColour } }],
          }],
        };
      } else {
        // Alternate between pie and bar charts for variety (or based on metadata)
        if (i % 2 === 0 || v.metadataTags.includes('Group')) {
          const data = Array.from(counts.entries()).map(([name, value], idx) => ({
            name,
            value,
            itemStyle: { color: palette[idx % palette.length] },
          }));

          option = {
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
        } else {
          // Bar chart
          const names = Array.from(counts.keys()).sort();
          const data = names.map((name, idx) => ({
            value: counts.get(name) || 0,
            itemStyle: { color: palette[idx % palette.length] }
          }));

          option = {
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { show: false },
            grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
            xAxis: { type: 'category', data: names, axisLabel: { rotate: names.length > 5 ? 30 : 0, fontSize: 11 } },
            yAxis: { type: 'value', minInterval: 1 },
            series: [{ type: 'bar', data }]
          };
        }
      }

      const clickHandler = (params: any) => {
        if (isBlindedGroup) return;
        const current = this.viewState.activeFilter();
        const clickedValue = String(params.name);
        if (current?.variableId === v.id && current.value === clickedValue) {
          this.viewState.clearFilter();
        } else {
          this.viewState.setFilter({ variableId: v.id, type: v.id, value: clickedValue });
        }
      };

      charts.push({
        id: v.id,
        label: v.label,
        isBlinded: isBlindedGroup,
        option,
        clickHandler
      });
    }

    return charts;
  });
}

