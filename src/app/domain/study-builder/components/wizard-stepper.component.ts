import { Component } from '@angular/core';
import { CdkStepper } from '@angular/cdk/stepper';
import { NgTemplateOutlet, NgClass } from '@angular/common';

export const WIZARD_STEP_LABELS = [
  'Study Details',
  'Treatment Arms & Blocks',
  'Sites & Strata',
  'Caps & Limits',
  'Review & Generate'
];

/**
 * WizardStepperComponent – a custom, Tailwind-styled multi-step wizard built
 * on top of `CdkStepper`. It renders a visual progress breadcrumb at the top
 * and projects each `cdk-step`'s content into the active panel below.
 */
@Component({
  selector: 'app-wizard-stepper',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  providers: [{ provide: CdkStepper, useExisting: WizardStepperComponent }],
  template: `
    <!-- ── Progress Header (Breadcrumbs) ── -->
    <div class="relative mb-10 px-2">
      <!-- Connecting line behind the circles -->
      <div class="absolute top-5 left-0 right-0 flex items-center px-5 pointer-events-none" aria-hidden="true">
        <div class="flex-1 h-0.5 bg-gray-200 dark:bg-slate-700"></div>
      </div>

      <div class="relative z-10 flex justify-between">
        @for (step of steps; track step; let i = $index) {
          <div class="flex flex-col items-center gap-1.5" style="flex: 1">
            <button
              type="button"
              (click)="onHeaderClick(i)"
              [disabled]="!isStepNavigable(i)"
              class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed"
              [ngClass]="headerCircleClasses(i)"
              [attr.aria-current]="selectedIndex === i ? 'step' : null"
              [attr.aria-label]="'Step ' + (i + 1) + ': ' + stepLabels[i]"
            >
              @if (isStepComplete(i)) {
                <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              } @else {
                <span aria-hidden="true">{{ i + 1 }}</span>
              }
            </button>
            <span
              class="text-xs font-medium text-center leading-tight hidden sm:block max-w-[80px]"
              [ngClass]="headerLabelClasses(i)"
            >{{ stepLabels[i] }}</span>
          </div>
        }
      </div>
    </div>

    <!-- ── Step Content ── -->
    @for (step of steps; track step; let i = $index) {
      <div [hidden]="selectedIndex !== i" role="tabpanel" [attr.aria-label]="stepLabels[i]">
        <ng-container [ngTemplateOutlet]="step.content"></ng-container>
      </div>
    }
  `
})
export class WizardStepperComponent extends CdkStepper {
  readonly stepLabels = WIZARD_STEP_LABELS;

  /** True when this step index has been passed and its control is valid. */
  isStepComplete(index: number): boolean {
    if (index >= this.selectedIndex) return false;
    const step = this.steps.get(index);
    return step?.stepControl ? step.stepControl.valid : true;
  }

  /** True when the user is allowed to jump to this step via the breadcrumb. */
  isStepNavigable(index: number): boolean {
    if (index <= this.selectedIndex) return true;
    for (let i = 0; i < index; i++) {
      const step = this.steps.get(i);
      if (step?.stepControl && !step.stepControl.valid) return false;
    }
    return true;
  }

  onHeaderClick(index: number): void {
    if (this.isStepNavigable(index)) {
      this.selectedIndex = index;
    }
  }

  headerCircleClasses(index: number): Record<string, boolean> {
    const isActive = this.selectedIndex === index;
    const isComplete = this.isStepComplete(index);
    return {
      'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/40': isActive,
      'bg-green-500 border-green-500 text-white': isComplete && !isActive,
      'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500': !isActive && !isComplete
    };
  }

  headerLabelClasses(index: number): Record<string, boolean> {
    const isActive = this.selectedIndex === index;
    const isComplete = this.isStepComplete(index) && !isActive;
    return {
      'text-indigo-600 dark:text-indigo-400 font-semibold': isActive,
      'text-green-600 dark:text-green-400': isComplete,
      'text-gray-400 dark:text-slate-500': !isActive && !isComplete
    };
  }
}
