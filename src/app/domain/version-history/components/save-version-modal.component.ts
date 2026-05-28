import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-save-version-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div class="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-6 border-b border-border-subtle shrink-0 flex justify-between items-center">
          <h2 class="text-xl font-bold text-main">Save Version Checkpoint</h2>
          <button (click)="cancel.emit()" class="text-muted hover:text-main">
            <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-main mb-1">Operator ID <span class="text-rose-500">*</span></label>
              <input type="text" formControlName="operatorId" class="w-full text-sm border border-border-strong rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-main focus:ring-2 focus:ring-indigo-500" placeholder="e.g. JDOE" />
            </div>
            <div>
              <label class="block text-sm font-medium text-main mb-1">Reason for Change <span class="text-rose-500">*</span></label>
              <textarea formControlName="reasonForChange" rows="3" class="w-full text-sm border border-border-strong rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-main focus:ring-2 focus:ring-indigo-500" placeholder="Describe what changed and why..."></textarea>
            </div>
            <div class="pt-4 flex justify-end gap-3">
              <button type="button" (click)="cancel.emit()" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">Cancel</button>
              <button type="submit" [disabled]="form.invalid" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-50">Save Version</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class SaveVersionModalComponent {
  private readonly fb = inject(FormBuilder);

  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ operatorId: string, reasonForChange: string }>();

  form: FormGroup = this.fb.group({
    operatorId: ['', Validators.required],
    reasonForChange: ['', Validators.required]
  });

  onSubmit() {
    if (this.form.valid) {
      this.save.emit(this.form.value);
    }
  }
}
