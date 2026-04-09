import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-zero-state',
  standalone: true,
  template: `
    <div
      class="flex flex-col items-center justify-center py-16 px-6
             border-2 border-dashed border-gray-200 dark:border-slate-600
             rounded-xl bg-white dark:bg-slate-800 text-center space-y-6"
      data-testid="zero-state"
    >
      <!-- Illustrative SVG -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 160 120"
        class="w-40 h-32 text-indigo-300 dark:text-indigo-700"
        aria-hidden="true"
        fill="none"
      >
        <!-- Background grid lines -->
        <line x1="20" y1="100" x2="140" y2="100" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="20" y1="75"  x2="140" y2="75"  stroke="currentColor" stroke-width="0.5" stroke-dasharray="3,3"/>
        <line x1="20" y1="50"  x2="140" y2="50"  stroke="currentColor" stroke-width="0.5" stroke-dasharray="3,3"/>
        <line x1="20" y1="25"  x2="140" y2="25"  stroke="currentColor" stroke-width="0.5" stroke-dasharray="3,3"/>

        <!-- Bar chart bars -->
        <rect x="32" y="60" width="18" height="40" rx="3" fill="currentColor" opacity="0.35"/>
        <rect x="58" y="40" width="18" height="60" rx="3" fill="currentColor" opacity="0.55"/>
        <rect x="84" y="50" width="18" height="50" rx="3" fill="currentColor" opacity="0.45"/>
        <rect x="110" y="30" width="18" height="70" rx="3" fill="currentColor" opacity="0.65"/>

        <!-- Donut ring (treatment balance) -->
        <circle cx="80" cy="16" r="11" stroke="currentColor" stroke-width="4" fill="none" opacity="0.4"/>
        <path d="M80 5 A11 11 0 0 1 91 16" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.9"/>

        <!-- Sparkle dots -->
        <circle cx="26" cy="18" r="2" fill="currentColor" opacity="0.5"/>
        <circle cx="134" cy="12" r="2" fill="currentColor" opacity="0.5"/>
        <circle cx="148" cy="40" r="1.5" fill="currentColor" opacity="0.3"/>
      </svg>

      <!-- Heading & description -->
      <div class="space-y-2 max-w-sm">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-slate-200">
          No schema generated yet
        </h3>
        <p class="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
          Configure your trial parameters in the form above, then click
          <span class="font-medium text-gray-700 dark:text-slate-200">Generate Schema</span>
          to produce a statistically balanced randomization schema.
        </p>
      </div>

      <!-- CTA -->
      <button
        type="button"
        (click)="loadPreset.emit()"
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
               bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
               text-white text-sm font-medium shadow-sm
               transition-colors focus-visible:outline-none focus-visible:ring-2
               focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        data-testid="load-preset-btn"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/>
        </svg>
        Load Standard Trial Preset
      </button>
    </div>
  `
})
export class ZeroStateComponent {
  /** Emitted when the user clicks "Load Standard Trial Preset". */
  readonly loadPreset = output<void>();
}
