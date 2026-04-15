import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  ViewChild,
} from '@angular/core';

/**
 * WizardNavigationComponent – renders the Back / Next / action buttons
 * for each wizard step.
 *
 * Step 1      : Next only
 * Steps 2–4   : Back + Next
 * Step 5      : Back + Monte Carlo + Generate Code dropdown + Generate Schema
 */
@Component({
  selector: 'app-wizard-navigation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="pt-4 border-t border-gray-200 dark:border-slate-700 flex flex-wrap justify-between gap-3">

      <!-- Back button (hidden on step 1) -->
      <div class="flex-none">
        @if (currentStep > 1) {
          <button
            type="button"
            (click)="back.emit()"
            class="min-h-[44px] flex items-center gap-2 px-5 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 font-medium transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        }
      </div>

      <!-- Right-side actions -->
      <div class="flex flex-wrap items-center gap-3 ml-auto">

        <!-- Steps 1–4: Next button -->
        @if (currentStep < totalSteps) {
          <button
            type="button"
            (click)="next.emit()"
            [disabled]="!canProceed"
            [title]="canProceed ? '' : 'Complete all required fields to continue'"
            class="min-h-[44px] flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            [class]="canProceed
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-500 shadow-sm'
              : 'bg-indigo-300 dark:bg-indigo-800 text-white cursor-not-allowed opacity-60'"
          >
            Next
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        }

        <!-- Step 5: Full action bar -->
        @if (currentStep === totalSteps) {
          <!-- Monte Carlo -->
          <button
            type="button"
            (click)="monteCarlo.emit()"
            [disabled]="!formValid"
            class="min-h-[44px] bg-white dark:bg-slate-700 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Run Statistical QA (Monte Carlo)
          </button>

          <!-- Generate Code dropdown -->
          <div class="relative inline-block text-left" #dropdownContainer>
            <button
              type="button"
              (click)="toggleDropdown()"
              [disabled]="!formValid"
              [attr.aria-haspopup]="'menu'"
              [attr.aria-expanded]="dropdownOpen"
              class="min-h-[44px] bg-white dark:bg-slate-700 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 px-6 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Generate Code
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            @if (dropdownOpen) {
              <div class="origin-bottom-right absolute right-0 bottom-full mb-2 w-40 rounded-xl shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-md ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-10 overflow-hidden">
                <div class="py-1" role="menu" aria-orientation="vertical">
                  <button type="button" (click)="emitGenerateCode('R')"     class="text-gray-700 dark:text-slate-200 block w-full text-left px-4 py-3 min-h-[44px] text-sm hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-colors" role="menuitem">R Script</button>
                  <button type="button" (click)="emitGenerateCode('SAS')"   class="text-gray-700 dark:text-slate-200 block w-full text-left px-4 py-3 min-h-[44px] text-sm hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-colors" role="menuitem">SAS Script</button>
                  <button type="button" (click)="emitGenerateCode('Python')" class="text-gray-700 dark:text-slate-200 block w-full text-left px-4 py-3 min-h-[44px] text-sm hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-colors" role="menuitem">Python Script</button>
                  <button type="button" (click)="emitGenerateCode('STATA')" class="text-gray-700 dark:text-slate-200 block w-full text-left px-4 py-3 min-h-[44px] text-sm hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-colors" role="menuitem">Stata Script</button>
                </div>
              </div>
            }
          </div>

          <!-- Generate Schema (primary) -->
          <button
            type="submit"
            [disabled]="!formValid || isGenerating"
            class="min-h-[44px] flex items-center gap-2 bg-indigo-600 dark:bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            @if (isGenerating) {
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Generating…
            } @else {
              Generate Schema
            }
          </button>
        }

      </div>
    </div>
  `
})
export class WizardNavigationComponent {
  @Input() currentStep = 1;
  @Input() totalSteps = 5;
  @Input() canProceed = true;
  @Input() formValid = false;
  @Input() isGenerating = false;

  @Output() readonly back = new EventEmitter<void>();
  @Output() readonly next = new EventEmitter<void>();
  @Output() readonly generateCode = new EventEmitter<'R' | 'SAS' | 'Python' | 'STATA'>();
  @Output() readonly monteCarlo = new EventEmitter<void>();

  @ViewChild('dropdownContainer') dropdownContainer!: ElementRef;

  dropdownOpen = false;

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  emitGenerateCode(lang: 'R' | 'SAS' | 'Python' | 'STATA'): void {
    this.generateCode.emit(lang);
    this.dropdownOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dropdownOpen) {
      this.dropdownOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (
      this.dropdownOpen &&
      this.dropdownContainer &&
      !this.dropdownContainer.nativeElement.contains(event.target)
    ) {
      this.dropdownOpen = false;
    }
  }
}
