import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy, inject, ChangeDetectorRef } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { Subscription } from 'rxjs';

/**
 * TagInputComponent – an interactive chip/tag input that reads and writes
 * a comma-separated string to an Angular AbstractControl.
 *
 * Usage:
 *   <app-tag-input [control]="form.get('sitesStr')" placeholder="Type a site ID…" />
 */
/**
 * ⚡ Bolt Performance Optimization:
 * Added ChangeDetectionStrategy.OnPush to minimize unnecessary re-renders.
 * View updates are now isolated to true input changes or explicit ChangeDetectorRef marks.
 */
@Component({
  selector: 'app-tag-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-wrap gap-1.5 items-center min-h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 cursor-text transition-colors"
      (click)="tagInput.focus()" (keydown.enter)="tagInput.focus()" tabindex="0"
    >
      @for (tag of tags; track tag) {
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 select-none">
          {{ tag }}
          <button
            type="button"
            (click)="removeTag(tag); $event.stopPropagation()" (keydown.enter)="removeTag(tag); $event.stopPropagation()" tabindex="0"
            class="ml-0.5 text-indigo-500 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 focus:outline-none leading-none font-bold"
            [attr.aria-label]="'Remove ' + tag"
          >×</button>
        </span>
      }
      <input
        #tagInput
        type="text"
        [value]="inputValue"
        (input)="inputValue = $any($event.target).value"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()"
        [placeholder]="tags.length === 0 ? placeholder : ''"
        [attr.aria-label]="placeholder"
        class="flex-1 min-w-[80px] outline-none text-sm bg-transparent py-0.5 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
      />
    </div>
    <p class="text-xs text-gray-600 dark:text-slate-400 mt-1">
      Press <kbd class="font-mono bg-gray-100 dark:bg-slate-600 dark:text-slate-300 border border-gray-200 dark:border-slate-500 rounded px-1">Enter</kbd>
      or comma to add · Backspace removes last tag
    </p>
  `
})
export class TagInputComponent implements OnInit, OnDestroy {
  @Input() control!: AbstractControl;
  @Input() placeholder = 'Type and press Enter…';

  @ViewChild('tagInput') tagInput!: ElementRef<HTMLInputElement>;

  tags: string[] = [];
  inputValue = '';

  private sub: Subscription | null = null;

  // ChangeDetectorRef injected to support OnPush when external form updates occur.
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.tags = this.parseValue(this.control.value);
    this.sub = this.control.valueChanges.subscribe(v => {
      // Only sync inward if the change came from outside (e.g. loadPreset)
      if (v !== this.toStr()) {
        this.tags = this.parseValue(v);
        // Explicitly mark for check because this component uses OnPush
        // and form control value changes are asynchronous/external.
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  parseValue(v: string | null | undefined): string[] {
    if (!v) return [];
    return v.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  toStr(): string {
    return this.tags.join(', ');
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitInput();
    } else if (event.key === 'Backspace' && !this.inputValue && this.tags.length > 0) {
      this.tags = this.tags.slice(0, -1);
      this.update();
    }
  }

  onBlur(): void {
    if (this.inputValue.trim()) {
      this.commitInput();
    }
  }

  commitInput(): void {
    const val = this.inputValue.trim().replace(/,+$/, '');
    if (val && !this.tags.includes(val)) {
      this.tags = [...this.tags, val];
      this.update();
    }
    this.inputValue = '';
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter(t => t !== tag);
    this.update();
  }

  private update(): void {
    this.control.setValue(this.toStr());
    this.control.markAsDirty();
  }
}
