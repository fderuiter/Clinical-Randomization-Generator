import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * SkeletonGridComponent
 *
 * Replaces the legacy loading spinner with a geometrically accurate placeholder
 * that mimics the final Analytics Dashboard + Results Grid layout.
 * Uses Tailwind's `animate-pulse` to produce a shimmering effect that
 * dramatically reduces perceived wait time.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-skeleton-grid',
  standalone: true,
  template: `
    <div class="animate-pulse space-y-4" data-testid="skeleton-grid" aria-busy="true" aria-label="Generating schema…">

      <!-- ── Analytics placeholders ──────────────────────────────────── -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <!-- Header bar -->
        <div class="h-4 w-40 rounded-md bg-gray-200 dark:bg-slate-700 mb-6"></div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

          <!-- Donut chart placeholder -->
          <div class="flex flex-col items-center justify-center h-56 gap-4">
            <div class="relative">
              <!-- Outer ring -->
              <div class="w-28 h-28 rounded-full bg-gray-200 dark:bg-slate-700"></div>
              <!-- Inner hole (white/bg circle to create donut shape) -->
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="w-16 h-16 rounded-full bg-white dark:bg-slate-800"></div>
              </div>
            </div>
            <!-- Legend stubs -->
            <div class="flex gap-3">
              <div class="h-3 w-14 rounded-full bg-gray-200 dark:bg-slate-700"></div>
              <div class="h-3 w-16 rounded-full bg-gray-200 dark:bg-slate-700"></div>
            </div>
          </div>

          <!-- Bar chart placeholder -->
          <div class="flex flex-col justify-end h-56 gap-2 px-4">
            <div class="flex items-end gap-3 h-40">
              <div class="flex-1 rounded-t-md bg-gray-200 dark:bg-slate-700" style="height: 55%"></div>
              <div class="flex-1 rounded-t-md bg-gray-200 dark:bg-slate-700" style="height: 80%"></div>
              <div class="flex-1 rounded-t-md bg-gray-200 dark:bg-slate-700" style="height: 65%"></div>
              <div class="flex-1 rounded-t-md bg-gray-200 dark:bg-slate-700" style="height: 90%"></div>
              <div class="flex-1 rounded-t-md bg-gray-200 dark:bg-slate-700" style="height: 45%"></div>
            </div>
            <!-- x-axis stub -->
            <div class="h-px w-full bg-gray-200 dark:bg-slate-700"></div>
            <!-- x-labels -->
            <div class="flex gap-3">
              @for (l of barLabels; track l) {
                <div class="flex-1 h-2.5 rounded-full bg-gray-200 dark:bg-slate-700"></div>
              }
            </div>
          </div>

        </div>
      </div>

      <!-- ── Table skeleton ───────────────────────────────────────────── -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">

        <!-- Toolbar / action bar stub -->
        <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div class="h-4 w-48 rounded-md bg-gray-200 dark:bg-slate-700"></div>
          <div class="flex gap-2">
            <div class="h-8 w-20 rounded-md bg-gray-200 dark:bg-slate-700"></div>
            <div class="h-8 w-20 rounded-md bg-gray-200 dark:bg-slate-700"></div>
          </div>
        </div>

        <table class="w-full">
          <!-- Table header -->
          <thead>
            <tr class="border-b border-gray-100 dark:border-slate-700">
              @for (col of headerCols; track col) {
                <th class="px-4 py-3">
                  <div class="h-3 rounded-md bg-gray-200 dark:bg-slate-700" [style.width]="col"></div>
                </th>
              }
            </tr>
          </thead>

          <!-- Skeleton rows -->
          <tbody>
            @for (row of skeletonRows; track row; let i = $index) {
              <tr class="border-b border-gray-50 dark:border-slate-700/50">
                @for (cell of cellWidths; track cell) {
                  <td class="px-4 py-3">
                    <div class="h-3 rounded-md bg-gray-200 dark:bg-slate-700" [style.width]="cell"></div>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>

        <!-- Pagination stub -->
        <div class="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div class="h-3 w-32 rounded-md bg-gray-200 dark:bg-slate-700"></div>
          <div class="flex gap-1">
            <div class="h-7 w-7 rounded-md bg-gray-200 dark:bg-slate-700"></div>
            <div class="h-7 w-7 rounded-md bg-gray-200 dark:bg-slate-700"></div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class SkeletonGridComponent {
  /** Used only to drive the @for loop for bar-chart x-axis label stubs. */
  readonly barLabels = [1, 2, 3, 4, 5];

  /**
   * Column header widths that loosely mimic the real grid columns:
   * Subject ID | Site | Stratum | Block | Treatment Arm | Actions
   */
  readonly headerCols = ['70%', '50%', '60%', '40%', '80%', '30%'];

  /**
   * Per-cell widths for each skeleton row, mirroring the header widths
   * with slight variance to feel organic rather than perfectly uniform.
   */
  readonly cellWidths = ['75%', '55%', '65%', '45%', '85%', '20%'];

  /** 12 skeleton rows – enough to fill a typical viewport. */
  readonly skeletonRows = Array.from({ length: 12 }, (_, i) => i);
}
