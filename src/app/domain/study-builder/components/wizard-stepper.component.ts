import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

/**
 * WizardStepperComponent – renders a horizontal step-progress indicator.
 *
 * Completed steps show a checkmark and are clickable (to navigate back).
 * The active step shows a filled circle with the step number.
 * Future steps are greyed out and non-interactive.
 */
@Component({
  selector: 'app-wizard-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <nav aria-label="Form progress" class="w-full">
      <ol class="flex items-center w-full">
        @for (step of steps; track step; let i = $index) {
          <!-- Connecting line before this step (skip for first) -->
          @if (i > 0) {
            <li class="flex-1 h-px mx-1"
                [class]="i < currentStep
                  ? 'bg-indigo-500'
                  : 'bg-gray-200 dark:bg-slate-600'">
            </li>
          }

          <!-- Step circle -->
          <li class="flex flex-col items-center shrink-0">
            <button
              type="button"
              [attr.aria-label]="'Step ' + (i + 1) + ' of ' + steps.length + ': ' + step"
              [attr.aria-current]="i + 1 === currentStep ? 'step' : null"
              [disabled]="i + 1 > currentStep"
              (click)="onStepClick(i + 1)"
              class="flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              [class]="stepCircleClass(i + 1)"
            >
              <!-- Completed: checkmark -->
              @if (i + 1 < currentStep) {
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              } @else {
                <!-- Active or future: step number -->
                <span class="text-xs font-semibold leading-none" aria-hidden="true">{{ i + 1 }}</span>
              }
            </button>

            <!-- Step label (hidden on mobile, visible sm+) -->
            <span
              class="hidden sm:block mt-1.5 text-xs font-medium text-center whitespace-nowrap"
              [class]="stepLabelClass(i + 1)"
            >
              {{ step }}
            </span>
          </li>
        }
      </ol>
    </nav>
  `
})
export class WizardStepperComponent {
  @Input() currentStep = 1;
  @Input() steps: string[] = [];
  @Output() stepClick = new EventEmitter<number>();

  onStepClick(step: number): void {
    if (step <= this.currentStep) {
      this.stepClick.emit(step);
    }
  }

  stepCircleClass(step: number): string {
    if (step < this.currentStep) {
      // Completed
      return 'bg-indigo-600 border-indigo-600 text-white cursor-pointer hover:bg-indigo-700';
    }
    if (step === this.currentStep) {
      // Active
      return 'bg-indigo-600 border-indigo-600 text-white cursor-default wizard-step-active';
    }
    // Future
    return 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500 cursor-not-allowed';
  }

  stepLabelClass(step: number): string {
    if (step < this.currentStep) {
      return 'text-indigo-600 dark:text-indigo-400';
    }
    if (step === this.currentStep) {
      return 'text-indigo-700 dark:text-indigo-300';
    }
    return 'text-gray-400 dark:text-slate-500';
  }
}
