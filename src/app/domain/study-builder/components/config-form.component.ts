import { Component, DestroyRef, ElementRef, HostListener, inject, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CdkStepperModule, StepperSelectionEvent } from '@angular/cdk/stepper';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { StudyBuilderStore, StratumFormValue, StudyBuilderFormValue } from '../store/study-builder.store';
import { TagInputComponent } from './tag-input.component';
import { WizardStepperComponent } from './wizard-stepper.component';

@Component({
  selector: 'app-config-form',
  standalone: true,
  imports: [ReactiveFormsModule, CdkDropList, CdkDrag, CdkDragHandle, TagInputComponent, CdkStepperModule, WizardStepperComponent],
  templateUrl: './config-form.component.html'
})
export class ConfigFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly facade = inject(RandomizationEngineFacade);
  readonly store = inject(StudyBuilderStore);
  private readonly destroyRef = inject(DestroyRef);

  dropdownOpen = false;
  /** Set to true when syncStratumCaps() had to discard previously entered caps. */
  capsWereReset = false;

  @ViewChild('dropdownContainer') dropdownContainer!: ElementRef;

  // ── Nested step groups ────────────────────────────────────────────────────

  /** Step 1 – Study Details */
  studyDetailsGroup: FormGroup = this.fb.group({
    protocolId: ['PRT-001', Validators.required],
    studyName: ['Demo Study', Validators.required],
    phase: ['III', Validators.required],
    seed: [''],
    subjectIdMask: ['[SiteID]-[StratumCode]-[001]', Validators.required]
  });

  /** Step 2 – Treatment Arms & Blocks */
  treatmentGroup: FormGroup = this.fb.group(
    {
      arms: this.fb.array([
        this.fb.group({ id: ['A'], name: ['Active'], ratio: [1, [Validators.required, Validators.min(1)]] }),
        this.fb.group({ id: ['B'], name: ['Placebo'], ratio: [1, [Validators.required, Validators.min(1)]] })
      ]),
      blockSizesStr: ['4, 6', Validators.required]
    },
    { validators: this.blockSizesValidator.bind(this) }
  );

  /** Step 3 – Sites & Strata */
  strataGroup: FormGroup = this.fb.group({
    sitesStr: ['101, 102, 103', Validators.required],
    strata: this.fb.array([
      this.fb.group({ id: ['age'], name: ['Age Group'], levelsStr: ['<65, >=65', Validators.required] })
    ])
  });

  /** Step 4 – Caps & Limits */
  capsGroup: FormGroup = this.fb.group({
    stratumCaps: this.fb.array([])
  });

  /** Master form composed of the four nested groups (step 5 is review-only). */
  form: FormGroup = this.fb.group({
    studyDetails: this.studyDetailsGroup,
    treatmentGroup: this.treatmentGroup,
    strataGroup: this.strataGroup,
    capsGroup: this.capsGroup
  });

  // ── Convenience accessors ─────────────────────────────────────────────────

  get arms(): FormArray { return this.treatmentGroup.get('arms') as FormArray; }
  get strata(): FormArray { return this.strataGroup.get('strata') as FormArray; }
  get stratumCaps(): FormArray { return this.capsGroup.get('stratumCaps') as FormArray; }
  get totalRatio(): number { return this.arms.controls.reduce((s, c) => s + (c.get('ratio')?.value || 0), 0); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Sync strata store whenever strata definitions change (no cap recalculation here).
    this.strataGroup.get('strata')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s: StratumFormValue[]) => this.store.setStrata(s));

    this.store.setStrata(this.strata.value as StratumFormValue[]);

    // Clear results whenever any form value changes.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.facade.clearResults());
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event): void {
    if (this.dropdownOpen && this.dropdownContainer && !this.dropdownContainer.nativeElement.contains(event.target))
      this.dropdownOpen = false;
  }

  // ── Stepper event ─────────────────────────────────────────────────────────

  /**
   * Called by the wizard's (selectionChange) output.  Triggers the Cartesian
   * product matrix calculation only when the user enters Step 4 (index 3).
   */
  onStepChange(event: StepperSelectionEvent): void {
    if (event.selectedIndex === 3) {
      this.store.setStrata(this.strata.value as StratumFormValue[]);
      this.syncStratumCaps();
    }
    if (event.selectedIndex !== 3) {
      this.capsWereReset = false;
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  /** Rebuild stratumCaps from the store's reactive `strataCombinations` computed signal. */
  syncStratumCaps(): void {
    const combinations = this.store.strataCombinations();
    const currentCaps = this.stratumCaps.value as { levels: string[]; cap: number }[];

    // Check if the combination set has changed so we can warn the user.
    const currentKeys = new Set(currentCaps.map(c => c.levels.join('|')));
    const newKeys = new Set(combinations.map(c => c.join('|')));
    const hadCustomCaps = currentCaps.some(c => c.cap !== 20);
    const structureChanged = currentCaps.length > 0 && (
      currentKeys.size !== newKeys.size ||
      [...currentKeys].some(k => !newKeys.has(k))
    );
    this.capsWereReset = hadCustomCaps && structureChanged;

    this.stratumCaps.clear({ emitEvent: false });
    for (const combo of combinations) {
      const existing = currentCaps.find(c => c.levels.join('|') === combo.join('|'));
      this.stratumCaps.push(
        this.fb.group({ levels: [combo], cap: [existing?.cap ?? 20, [Validators.required, Validators.min(1)]] }),
        { emitEvent: false }
      );
    }
  }

  loadPreset(type: 'simple' | 'standard' | 'complex'): void {
    const { protocolId, studyName, phase, sitesStr, blockSizesStr, subjectIdMask, arms, strata } =
      this.store.getPreset(type);

    this.studyDetailsGroup.patchValue({ protocolId, studyName, phase, subjectIdMask, seed: '' }, { emitEvent: false });
    this.treatmentGroup.patchValue({ blockSizesStr }, { emitEvent: false });

    this.arms.clear({ emitEvent: false });
    arms.forEach(a => this.arms.push(
      this.fb.group({ id: [a.id], name: [a.name], ratio: [a.ratio, [Validators.required, Validators.min(1)]] }),
      { emitEvent: false }
    ));

    this.strataGroup.patchValue({ sitesStr }, { emitEvent: false });
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
    this.treatmentGroup.updateValueAndValidity();
  }

  removeArm(index: number): void {
    if (this.arms.length > 2) { this.arms.removeAt(index); this.treatmentGroup.updateValueAndValidity(); }
  }

  incrementRatio(index: number): void {
    const ctrl = this.arms.at(index).get('ratio');
    if (ctrl) { ctrl.setValue((ctrl.value || 0) + 1); }
    this.treatmentGroup.updateValueAndValidity();
  }

  decrementRatio(index: number): void {
    const ctrl = this.arms.at(index).get('ratio');
    if (ctrl && ctrl.value > 1) { ctrl.setValue(ctrl.value - 1); }
    this.treatmentGroup.updateValueAndValidity();
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
  }

  onGenerateCode(language: 'R' | 'SAS' | 'Python'): void {
    if (this.form.valid) {
      try {
        this.facade.openCodeGenerator(this.store.buildConfig(this.flatFormValue), language);
        this.dropdownOpen = false;
      } catch (e) { console.error('Error generating code config:', e); alert('Error generating code. Please check your configuration.'); }
    }
  }

  onSubmit(): void {
    if (this.form.valid) {
      try { this.facade.generateSchema(this.store.buildConfig(this.flatFormValue)); }
      catch (e) { console.error('Error generating schema config:', e); alert('Error generating schema. Please check your configuration.'); }
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Flatten the nested FormGroup value back to the `StudyBuilderFormValue` shape. */
  get flatFormValue(): StudyBuilderFormValue {
    const sd = this.studyDetailsGroup.value;
    const tr = this.treatmentGroup.value;
    const sg = this.strataGroup.value;
    const cg = this.capsGroup.value;
    return {
      protocolId: sd.protocolId,
      studyName: sd.studyName,
      phase: sd.phase,
      seed: sd.seed,
      subjectIdMask: sd.subjectIdMask,
      arms: tr.arms,
      blockSizesStr: tr.blockSizesStr,
      sitesStr: sg.sitesStr,
      strata: sg.strata,
      stratumCaps: cg.stratumCaps
    };
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
