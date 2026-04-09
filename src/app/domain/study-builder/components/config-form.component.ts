import { Component, DestroyRef, ElementRef, HostListener, inject, OnInit, signal, Signal, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs/operators';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { StudyBuilderStore, StratumFormValue } from '../store/study-builder.store';
import { TagInputComponent } from './tag-input.component';
import { previewSubjectIdMask, validateSubjectIdMask } from '../../randomization-engine/core/subject-id-engine';

@Component({
  selector: 'app-config-form',
  standalone: true,
  imports: [ReactiveFormsModule, CdkDropList, CdkDrag, CdkDragHandle, TagInputComponent, MatTooltipModule],
  templateUrl: './config-form.component.html'
})
export class ConfigFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly facade = inject(RandomizationEngineFacade);
  readonly store = inject(StudyBuilderStore);
  private readonly destroyRef = inject(DestroyRef);

  dropdownOpen = false;
  /** Controls visibility of the Advanced Settings accordion section. */
  readonly showAdvanced = signal(false);
  @ViewChild('dropdownContainer') dropdownContainer!: ElementRef;

  /** Live preview text for the subject ID mask input. Reactive via RxJS → Signal. */
  readonly subjectIdPreview: Signal<string>;
  /** True when the current mask has a syntax error. */
  readonly subjectIdMaskInvalid: Signal<boolean>;

  form: FormGroup = this.fb.group(
    {
      protocolId: ['PRT-001', Validators.required],
      studyName: ['Demo Study', Validators.required],
      phase: ['III', Validators.required],
      arms: this.fb.array([
        this.fb.group({ id: ['A'], name: ['Active'], ratio: [1, [Validators.required, Validators.min(1)]] }),
        this.fb.group({ id: ['B'], name: ['Placebo'], ratio: [1, [Validators.required, Validators.min(1)]] })
      ]),
      strata: this.fb.array([
        this.fb.group({ id: ['age'], name: ['Age Group'], levelsStr: ['<65, >=65', Validators.required] })
      ]),
      sitesStr: ['101, 102, 103', Validators.required],
      blockSizesStr: ['4, 6', Validators.required],
      stratumCaps: this.fb.array([]),
      seed: [''],
      subjectIdMask: ['{SITE}-{STRATUM}-{SEQ:3}', Validators.required]
    },
    { validators: this.blockSizesValidator.bind(this) }
  );

  constructor() {
    const maskCtrl = this.form.get('subjectIdMask')!;
    const mask$ = maskCtrl.valueChanges.pipe(
      startWith(maskCtrl.value as string),
      map((v: string) => v ?? '')
    );
    this.subjectIdPreview = toSignal(
      mask$.pipe(map(mask => previewSubjectIdMask(mask))),
      { initialValue: previewSubjectIdMask(maskCtrl.value as string) }
    );
    this.subjectIdMaskInvalid = toSignal(
      mask$.pipe(map(mask => !validateSubjectIdMask(mask).valid)),
      { initialValue: !validateSubjectIdMask(maskCtrl.value as string).valid }
    );
  }

  ngOnInit(): void {
    this.form.get('strata')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s: StratumFormValue[]) => { this.store.setStrata(s); this.syncStratumCaps(); });
    this.store.setStrata(this.strata.value as StratumFormValue[]);
    this.syncStratumCaps();
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.facade.clearResults());
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event): void {
    if (this.dropdownOpen && this.dropdownContainer && !this.dropdownContainer.nativeElement.contains(event.target))
      this.dropdownOpen = false;
  }

  get arms(): FormArray { return this.form.get('arms') as FormArray; }
  get strata(): FormArray { return this.form.get('strata') as FormArray; }
  get stratumCaps(): FormArray { return this.form.get('stratumCaps') as FormArray; }
  get totalRatio(): number { return this.arms.controls.reduce((s, c) => s + (c.get('ratio')?.value || 0), 0); }

  /** Rebuild stratumCaps from the store's reactive `strataCombinations` computed signal. */
  syncStratumCaps(): void {
    const combinations = this.store.strataCombinations();
    const currentCaps = this.stratumCaps.value as { levels: string[]; cap: number }[];
    this.stratumCaps.clear({ emitEvent: false });
    for (const combo of combinations) {
      const existing = currentCaps.find(c => c.levels.join('|') === combo.join('|'));
      this.stratumCaps.push(
        this.fb.group({ levels: [combo], cap: [existing?.cap ?? 20, [Validators.required, Validators.min(1)]] }),
        { emitEvent: false }
      );
    }
  }

  toggleAdvanced(): void { this.showAdvanced.update(v => !v); }

  loadPreset(type: 'simple' | 'standard' | 'complex'): void {
    const { protocolId, studyName, phase, sitesStr, blockSizesStr, subjectIdMask, arms, strata } =
      this.store.getPreset(type);
    this.form.patchValue({ protocolId, studyName, phase, sitesStr, blockSizesStr, subjectIdMask, seed: '' }, { emitEvent: false });
    this.arms.clear({ emitEvent: false });
    arms.forEach(a => this.arms.push(
      this.fb.group({ id: [a.id], name: [a.name], ratio: [a.ratio, [Validators.required, Validators.min(1)]] }),
      { emitEvent: false }
    ));
    this.strata.clear({ emitEvent: false });
    strata.forEach(s => this.strata.push(
      this.fb.group({ id: [s.id], name: [s.name], levelsStr: [s.levelsStr, Validators.required] }),
      { emitEvent: false }
    ));
    this.form.updateValueAndValidity();
    this.store.setStrata(this.strata.value as StratumFormValue[]);
    this.syncStratumCaps();
  }

  parseCommaSeparated(value: string | null | undefined): string[] {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  addArm(): void {
    this.arms.push(this.fb.group({
      id: [String.fromCharCode(65 + this.arms.length)], name: [''], ratio: [1, [Validators.required, Validators.min(1)]]
    }));
    this.form.updateValueAndValidity();
  }

  removeArm(index: number): void {
    if (this.arms.length > 2) { this.arms.removeAt(index); this.form.updateValueAndValidity(); }
  }

  incrementRatio(index: number): void {
    const ctrl = this.arms.at(index).get('ratio');
    if (ctrl) { ctrl.setValue((ctrl.value || 0) + 1); }
    this.form.updateValueAndValidity();
  }

  decrementRatio(index: number): void {
    const ctrl = this.arms.at(index).get('ratio');
    if (ctrl && ctrl.value > 1) { ctrl.setValue(ctrl.value - 1); }
    this.form.updateValueAndValidity();
  }

  addStratum(): void {
    this.strata.push(this.fb.group({ id: ['stratum_' + Date.now()], name: [''], levelsStr: ['', Validators.required] }));
  }

  removeStratum(index: number): void { this.strata.removeAt(index); }

  onStrataDrop(event: CdkDragDrop<FormGroup[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const control = this.strata.at(event.previousIndex);
    this.strata.removeAt(event.previousIndex, { emitEvent: false });
    this.strata.insert(event.currentIndex, control, { emitEvent: false });
    this.store.setStrata(this.strata.value as StratumFormValue[]);
    this.syncStratumCaps();
  }

  onGenerateCode(language: 'R' | 'SAS' | 'Python'): void {
    if (this.form.valid) {
      try { this.facade.openCodeGenerator(this.store.buildConfig(this.form.value), language); this.dropdownOpen = false; }
      catch (e) { console.error('Error generating code config:', e); alert('Error generating code. Please check your configuration.'); }
    }
  }

  onRunMonteCarlo(): void {
    if (this.form.valid) {
      try { this.facade.runMonteCarlo(this.store.buildConfig(this.form.value)); }
      catch (e) { console.error('Error starting Monte Carlo simulation:', e); alert('Error starting simulation. Please check your configuration.'); }
    }
  }

  onSubmit(): void {
    if (this.form.valid) {
      try { this.facade.generateSchema(this.store.buildConfig(this.form.value)); }
      catch (e) { console.error('Error generating schema config:', e); alert('Error generating schema. Please check your configuration.'); }
    }
  }

  private blockSizesValidator(group: FormGroup): { invalidBlockSize: true } | null {
    const arms = group.get('arms') as FormArray;
    const blockSizesStr = group.get('blockSizesStr')?.value as string;
    if (!arms || !blockSizesStr) return null;
    const total = arms.controls.reduce((s, c) => s + (c.get('ratio')?.value || 0), 0);
    const sizes = blockSizesStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    for (const size of sizes) { if (size % total !== 0) return { invalidBlockSize: true }; }
    return null;
  }
}
