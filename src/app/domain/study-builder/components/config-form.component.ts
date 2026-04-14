import { Component, computed, DestroyRef, ElementRef, HostListener, inject, OnInit, signal, Signal, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs/operators';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { StudyBuilderStore, StratumFormValue } from '../store/study-builder.store';
import { TagInputComponent } from './tag-input.component';
import { previewSubjectIdMask, validateSubjectIdMask } from '../../randomization-engine/core/subject-id-engine';
import { BlockPreviewComponent, ArmInput } from './block-preview.component';
import { computeProportionalCaps, validateProportionalPercentages } from '../../randomization-engine/core/cap-strategy';
import { CapStrategy } from '../../core/models/randomization.model';

@Component({
  selector: 'app-config-form',
  standalone: true,
  imports: [ReactiveFormsModule, CdkDropList, CdkDrag, CdkDragHandle, TagInputComponent, MatTooltipModule, BlockPreviewComponent],
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

  /** Live signal of the arms FormArray values for BlockPreviewComponent. */
  readonly armsSignal: Signal<ArmInput[]>;
  /** Live signal of the parsed block sizes for BlockPreviewComponent. */
  readonly blockSizesSignal: Signal<number[]>;

  /**
   * Reactive signal tracking per-factor per-level percentages for the
   * Proportional strategy. Shape: { [factorId]: { [levelName]: number } }
   */
  readonly proportionalPercentages = signal<Record<string, Record<string, number>>>({});

  /**
   * Reactive signal tracking per-factor per-level marginal caps for the
   * Marginal Only strategy. Shape: { [factorId]: { [levelName]: number } }
   */
  readonly marginalCaps = signal<Record<string, Record<string, number | undefined>>>({});

  /**
   * Reactive signal tracking per-factor per-level probabilities for minimization.
   * Shape: { [factorId]: { [levelName]: number } }
   */
  readonly minimizationProbabilities = signal<Record<string, Record<string, number>>>({});

  /** Whether the computed proportional matrix has been generated and is ready to display. */
  readonly matrixComputed = signal(false);

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
      blockSelectionType: ['RANDOM_POOL'],
      blockOverrides: this.fb.array([]),
      stratumCaps: this.fb.array([]),
      seed: [''],
      subjectIdMask: ['{SITE}-{STRATUM}-{SEQ:3}', Validators.required],
      capStrategy: ['MANUAL_MATRIX'],
      globalCap: [100, [Validators.required, Validators.min(1)]],
      randomizationMethod: ['BLOCK'],
      minimizationP: [0.8, [Validators.required, Validators.min(0.5), Validators.max(1.0)]],
      totalSampleSize: [120, [Validators.required, Validators.min(1)]]
    },
    { validators: [this.blockSizesValidator.bind(this), this.minimizationProbabilitiesValidator.bind(this)] }
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

    const armsCtrl = this.form.get('arms')!;
    this.armsSignal = toSignal(
      armsCtrl.valueChanges.pipe(startWith(armsCtrl.value as ArmInput[])),
      { initialValue: armsCtrl.value as ArmInput[] }
    );

    const blockSizesCtrl = this.form.get('blockSizesStr')!;
    const parseBlockSizes = (v: string | null | undefined): number[] =>
      (v ?? '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    this.blockSizesSignal = toSignal(
      blockSizesCtrl.valueChanges.pipe(
        startWith(blockSizesCtrl.value as string),
        map((v: string) => parseBlockSizes(v))
      ),
      { initialValue: parseBlockSizes(blockSizesCtrl.value as string) }
    );
  }

  ngOnInit(): void {
    this.form.get('strata')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s: StratumFormValue[]) => {
        this.store.setStrata(s);
        this.syncStratumCaps();
        this.syncLevelDetails(s);
        this.matrixComputed.set(false);
      });
    this.store.setStrata(this.strata.value as StratumFormValue[]);
    this.syncStratumCaps();
    this.syncLevelDetails(this.strata.value as StratumFormValue[]);
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.facade.clearResults());

    // When the user manually edits a computed cap, switch strategy back to Manual Matrix.
    // The `matrixComputed()` guard ensures this only fires AFTER the user has clicked
    // "Compute Matrix" – not during ngOnInit initialization (which uses emitEvent: false)
    // and not before the user has computed anything.
    this.stratumCaps.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.matrixComputed()) {
          this.form.get('capStrategy')?.setValue('MANUAL_MATRIX', { emitEvent: false });
          this.matrixComputed.set(false);
        }
      });

    // When the global cap changes, the computed matrix is stale - reset it.
    this.form.get('globalCap')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.matrixComputed.set(false));

    // Enable/disable globalCap validators based on the active cap strategy.
    // When not in PROPORTIONAL mode the field is hidden and irrelevant, so we
    // disable the control to prevent it from invalidating the form.
    this.form.get('capStrategy')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((strategy: string) => {
        const globalCapCtrl = this.form.get('globalCap');
        if (strategy === 'PROPORTIONAL') {
          globalCapCtrl?.enable();
        } else {
          globalCapCtrl?.disable();
        }
      });
    // Initialise: disable when not starting in PROPORTIONAL mode.
    if (this.capStrategy !== 'PROPORTIONAL') {
      this.form.get('globalCap')?.disable();
    }

    // Enable/disable mode-specific controls based on the randomization method.
    this.form.get('randomizationMethod')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((method: string) => {
        const minimizationP = this.form.get('minimizationP');
        const totalSampleSize = this.form.get('totalSampleSize');
        const blockSizesStr = this.form.get('blockSizesStr');
        const blockSelectionType = this.form.get('blockSelectionType');
        const blockOverrides = this.form.get('blockOverrides');
        if (method === 'MINIMIZATION') {
          minimizationP?.enable();
          totalSampleSize?.enable();
          blockSizesStr?.disable();
          blockSelectionType?.disable();
          blockOverrides?.disable();
        } else {
          minimizationP?.disable();
          totalSampleSize?.disable();
          blockSizesStr?.enable();
          blockSelectionType?.enable();
          blockOverrides?.enable();
        }
        this.form.updateValueAndValidity();
      });
    // Initialise: disable controls that are irrelevant for the starting method.
    if (this.randomizationMethod === 'MINIMIZATION') {
      this.form.get('blockSizesStr')?.disable();
      this.form.get('blockSelectionType')?.disable();
      this.form.get('blockOverrides')?.disable();
    } else {
      this.form.get('minimizationP')?.disable();
      this.form.get('totalSampleSize')?.disable();
    }
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event): void {
    if (this.dropdownOpen && this.dropdownContainer && !this.dropdownContainer.nativeElement.contains(event.target))
      this.dropdownOpen = false;
  }

  get arms(): FormArray { return this.form.get('arms') as FormArray; }
  get strata(): FormArray { return this.form.get('strata') as FormArray; }
  get stratumCaps(): FormArray { return this.form.get('stratumCaps') as FormArray; }
  get blockOverrides(): FormArray { return this.form.get('blockOverrides') as FormArray; }
  get totalRatio(): number { return this.arms.controls.reduce((s, c) => s + (c.get('ratio')?.value || 0), 0); }

  /** Current block selection type for the global strategy. */
  get blockSelectionType(): 'RANDOM_POOL' | 'FIXED_SEQUENCE' {
    return (this.form.get('blockSelectionType')?.value as 'RANDOM_POOL' | 'FIXED_SEQUENCE') ?? 'RANDOM_POOL';
  }

  /** Current randomization method. */
  get randomizationMethod(): 'BLOCK' | 'MINIMIZATION' {
    return (this.form.get('randomizationMethod')?.value as 'BLOCK' | 'MINIMIZATION') ?? 'BLOCK';
  }

  /** Current cap strategy value. */
  get capStrategy(): CapStrategy { return (this.form.get('capStrategy')?.value as CapStrategy) ?? 'MANUAL_MATRIX'; }

  /** Parsed list of strata with their levels for the cap strategy UI. */
  get strataWithLevels(): { id: string; name: string; levels: string[] }[] {
    return (this.strata.value as StratumFormValue[]).map(s => ({
      id: s.id,
      name: s.name,
      levels: s.levelsStr.split(',').map(l => l.trim()).filter(l => l)
    }));
  }

  /** Percentage validation: per factor, indicates if its levels sum to 100%. */
  readonly proportionalFactorErrors = computed(() => {
    const percentages = this.proportionalPercentages();
    const strataList = this.strataWithLevels;
    const strata = strataList.map(s => ({ ...s, levelDetails: undefined as undefined }));
    return validateProportionalPercentages(strata, percentages);
  });

  /** True when the global cap control is valid and its value is an integer. */
  private get isGlobalCapValidForCompute(): boolean {
    const globalCapControl = this.form.get('globalCap');
    if (!globalCapControl?.valid) return false;
    return Number.isInteger(Number(globalCapControl.value));
  }

  /** True when all factor percentages sum to 100, there is at least one factor, and the global cap is valid. */
  get canComputeMatrix(): boolean {
    const errors = this.proportionalFactorErrors();
    const strataList = this.strataWithLevels;
    if (strataList.length === 0) return false;
    if (!this.isGlobalCapValidForCompute) return false;
    return Object.keys(errors).length === 0;
  }

  /** Retrieve a percentage value for a factor/level. */
  getPercentage(factorId: string, level: string): number {
    return this.proportionalPercentages()[factorId]?.[level] ?? 0;
  }

  /** Retrieve the running total of percentages for a factor. */
  getFactorPercentageTotal(factorId: string, levels: string[]): number {
    const percentages = this.proportionalPercentages();
    return levels.reduce((sum, l) => sum + (percentages[factorId]?.[l] ?? 0), 0);
  }

  /** True if the factor's percentage total is invalid (not 100). */
  isFactorPercentageInvalid(factorId: string): boolean {
    return this.proportionalFactorErrors()[factorId] === true;
  }

  /** Update a percentage value for a given factor level (called from the template). */
  setPercentage(factorId: string, level: string, value: number): void {
    this.proportionalPercentages.update(prev => ({
      ...prev,
      [factorId]: { ...(prev[factorId] ?? {}), [level]: value }
    }));
    this.matrixComputed.set(false);
  }

  /** Retrieve a marginal cap for a factor/level; returns undefined when not set (uncapped). */
  getMarginalCap(factorId: string, level: string): number | undefined {
    return this.marginalCaps()[factorId]?.[level];
  }

  /** Update a marginal cap for a given factor level (called from the template).
   *  Passing undefined removes the cap (level becomes uncapped). */
  setMarginalCap(factorId: string, level: string, value: number | undefined): void {
    this.marginalCaps.update(prev => {
      const factorCaps = { ...(prev[factorId] ?? {}) };
      if (value === undefined) {
        delete factorCaps[level];
      } else {
        factorCaps[level] = value;
      }
      return { ...prev, [factorId]: factorCaps };
    });
  }

  /** Parse a raw input string into a marginal cap number or undefined (uncapped). */
  parseMarginalCapInput(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    const n = Number(trimmed);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  }

  /**
   * Run the Largest Remainder Method and populate `stratumCaps` with the computed values.
   * Switches the effective strategy to render the hybrid editable matrix.
   */
  computeMatrix(): void {
    const strata = this.strataWithLevels;
    if (!strata.length) return;
    const globalCap = this.form.get('globalCap')?.value as number ?? 100;
    const percentages = this.proportionalPercentages();

    const caps = computeProportionalCaps(
      strata.map(s => ({ id: s.id, name: s.name, levels: s.levels })),
      globalCap,
      percentages
    );

    // Repopulate stratumCaps with the computed values.
    this.stratumCaps.clear({ emitEvent: false });
    for (const cap of caps) {
      this.stratumCaps.push(
        this.fb.group({ levels: [cap.levels], cap: [cap.cap, [Validators.required, Validators.min(0)]] }),
        { emitEvent: false }
      );
    }
    this.matrixComputed.set(true);
  }

  /** Rebuild stratumCaps from the store's reactive `strataCombinations` computed signal. */
  syncStratumCaps(): void {
    const combinations = this.store.strataCombinations();
    const currentCaps = this.stratumCaps.value as { levels: string[]; cap: number }[];
    this.stratumCaps.clear({ emitEvent: false });
    for (const combo of combinations) {
      const existing = currentCaps.find(c => c.levels.join('|') === combo.join('|'));
      this.stratumCaps.push(
        this.fb.group({ levels: [combo], cap: [existing?.cap ?? 20, [Validators.required, Validators.min(0)]] }),
        { emitEvent: false }
      );
    }
  }

  /**
   * Synchronise the proportional percentages, marginal caps, and minimization
   * probabilities signals whenever strata levels change, preserving existing
   * values where level names match.
   */
  private syncLevelDetails(strataVals: StratumFormValue[]): void {
    this.proportionalPercentages.update(prev => {
      const next: Record<string, Record<string, number>> = {};
      for (const s of strataVals) {
        const levels = s.levelsStr.split(',').map(l => l.trim()).filter(l => l);
        next[s.id] = {};
        for (const level of levels) {
          next[s.id][level] = prev[s.id]?.[level] ?? 0;
        }
      }
      return next;
    });

    this.marginalCaps.update(prev => {
      const next: Record<string, Record<string, number | undefined>> = {};
      for (const s of strataVals) {
        const levels = s.levelsStr.split(',').map(l => l.trim()).filter(l => l);
        next[s.id] = {};
        for (const level of levels) {
          const existingCap = prev[s.id]?.[level];
          if (existingCap !== undefined) {
            next[s.id][level] = existingCap;
          }
        }
      }
      return next;
    });

    this.minimizationProbabilities.update(prev => {
      const next: Record<string, Record<string, number>> = {};
      for (const s of strataVals) {
        const levels = s.levelsStr.split(',').map(l => l.trim()).filter(l => l);
        next[s.id] = {};
        for (const level of levels) {
          next[s.id][level] = prev[s.id]?.[level] ?? 0;
        }
      }
      return next;
    });
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
    this.syncLevelDetails(this.strata.value as StratumFormValue[]);
    this.matrixComputed.set(false);
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

  /** Add a new block override card. */
  addBlockOverride(): void {
    this.blockOverrides.push(this.fb.group({
      targetType: ['site'],
      targetId: [''],
      sizesStr: [this.form.get('blockSizesStr')?.value ?? '4, 6'],
      selectionType: ['RANDOM_POOL']
    }));
  }

  /** Remove a block override card by index. */
  removeBlockOverride(index: number): void {
    this.blockOverrides.removeAt(index);
  }

  /**
   * Returns the dynamically-populated options for the Target ID dropdown
   * of a block override card, based on the selected target type.
   */
  getBlockOverrideTargetOptions(index: number): string[] {
    const targetType = this.blockOverrides.at(index)?.get('targetType')?.value as string;
    if (targetType === 'site') {
      return (this.form.get('sitesStr')?.value as string ?? '')
        .split(',').map(s => s.trim()).filter(s => s);
    }
    // For stratum: return computed stratum codes
    return this.computedStratumCodes();
  }

  /**
   * Computes all stratum codes from the current strata configuration.
   * These codes are used as keys in `stratumBlockOverrides`.
   */
  computedStratumCodes(): string[] {
    const strataVals = this.strata.value as StratumFormValue[];
    const validStrata = strataVals.filter(s => s.levelsStr?.trim());
    if (validStrata.length === 0) return [];

    const levelsList = validStrata.map(s =>
      s.levelsStr.split(',').map(l => l.trim()).filter(l => l)
    );

    let combos: string[][] = [[]];
    for (const levels of levelsList) {
      combos = combos.flatMap(c => levels.map(l => [...c, l]));
    }

    return combos.map(combo =>
      combo.map(l => l.substring(0, 3).toUpperCase()).join('-')
    );
  }

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
      try { this.facade.openCodeGenerator(this.store.buildConfig(this.buildFormValue()), language); this.dropdownOpen = false; }
      catch (e) { console.error('Error generating code config:', e); alert('Error generating code. Please check your configuration.'); }
    }
  }

  onRunMonteCarlo(): void {
    if (this.form.valid) {
      try { this.facade.runMonteCarlo(this.store.buildConfig(this.buildFormValue())); }
      catch (e) { console.error('Error starting Monte Carlo simulation:', e); alert('Error starting simulation. Please check your configuration.'); }
    }
  }

  onSubmit(): void {
    if (this.form.valid) {
      try { this.facade.generateSchema(this.store.buildConfig(this.buildFormValue())); }
      catch (e) { console.error('Error generating schema config:', e); alert('Error generating schema. Please check your configuration.'); }
    }
  }

  /** Build the full form value including levelDetails from signals. */
  private buildFormValue() {
    // getRawValue() includes disabled controls (e.g., globalCap when strategy ≠ PROPORTIONAL).
    const base = this.form.getRawValue();
    const levelDetails: Record<string, { name: string; targetPercentage: number; marginalCap?: number; expectedProbability?: number }[]> = {};
    const percentages = this.proportionalPercentages();
    const caps = this.marginalCaps();
    const minimizationProbs = this.minimizationProbabilities();
    for (const s of (this.strata.value as StratumFormValue[])) {
      const levels = s.levelsStr.split(',').map((l: string) => l.trim()).filter((l: string) => l);
      levelDetails[s.id] = levels.map(level => {
        const marginalCap = caps[s.id]?.[level];
        const minimizationExpectedProbability = minimizationProbs[s.id]?.[level];
        return {
          name: level,
          targetPercentage: percentages[s.id]?.[level] ?? 0,
          ...(marginalCap !== undefined ? { marginalCap } : {}),
          ...(minimizationExpectedProbability !== undefined ? { expectedProbability: minimizationExpectedProbability / 100 } : {})
        };
      });
    }

    // Build block overrides data from the blockOverrides form array.
    const blockOverrides = (this.blockOverrides.value as {
      targetType: 'site' | 'stratum';
      targetId: string;
      sizesStr: string;
      selectionType: 'RANDOM_POOL' | 'FIXED_SEQUENCE';
    }[]).filter(ov => ov.targetId?.trim());

    return { ...base, levelDetails, blockOverrides };
  }

  private blockSizesValidator(group: FormGroup): { invalidBlockSize: true } | null {
    const method = group.get('randomizationMethod')?.value as string;
    if (method === 'MINIMIZATION') return null;
    const arms = group.get('arms') as FormArray;
    const blockSizesStr = group.get('blockSizesStr')?.value as string;
    if (!arms || !blockSizesStr) return null;
    const total = arms.controls.reduce((s, c) => s + (c.get('ratio')?.value || 0), 0);
    const sizes = blockSizesStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    for (const size of sizes) { if (size % total !== 0) return { invalidBlockSize: true }; }
    return null;
  }

  /**
   * Form-level validator that checks per-factor probability totals when
   * Minimization is the active method. Each factor's levels must sum to 100%,
   * and every individual probability must be finite and within [0, 100].
   */
  private minimizationProbabilitiesValidator(group: FormGroup): { minimizationProbabilitiesInvalid: true } | null {
    const method = group.get('randomizationMethod')?.value as string;
    if (method !== 'MINIMIZATION') return null;
    const strata = (group.get('strata') as FormArray).value as StratumFormValue[];
    const probs = this.minimizationProbabilities();
    for (const s of strata) {
      const levels = s.levelsStr.split(',').map(l => l.trim()).filter(l => l);
      if (levels.length === 0) continue;
      let total = 0;
      for (const l of levels) {
        const v = probs[s.id]?.[l] ?? 0;
        if (!Number.isFinite(v) || v < 0 || v > 100) return { minimizationProbabilitiesInvalid: true };
        total += v;
      }
      if (Math.abs(total - 100) > 0.01) return { minimizationProbabilitiesInvalid: true };
    }
    return null;
  }

  // ── Minimization helpers ──────────────────────────────────────────────────

  getStrataId(index: number): string {
    return (this.strata.at(index).get('id')?.value as string) ?? '';
  }

  getStrataLevels(index: number): string[] {
    const levelsStr = this.strata.at(index).get('levelsStr')?.value as string ?? '';
    return levelsStr.split(',').map(l => l.trim()).filter(l => l);
  }

  getMinimizationProbability(factorId: string, level: string): number {
    return this.minimizationProbabilities()[factorId]?.[level] ?? 0;
  }

  getMinimizationProbabilityTotal(factorId: string, levels: string[]): number {
    const probs = this.minimizationProbabilities();
    return levels.reduce((sum, l) => sum + (probs[factorId]?.[l] ?? 0), 0);
  }

  isMinimizationProbabilityInvalid(factorId: string): boolean {
    const levels = this.strataWithLevels.find(s => s.id === factorId)?.levels ?? [];
    if (levels.length === 0) return false;
    const total = this.getMinimizationProbabilityTotal(factorId, levels);
    return Math.abs(total - 100) > 0.01;
  }

  setMinimizationProbability(factorId: string, level: string, value: number): void {
    // Clamp to [0, 100] and treat non-finite inputs as 0.
    const sanitized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    this.minimizationProbabilities.update(prev => ({
      ...prev,
      [factorId]: { ...(prev[factorId] ?? {}), [level]: sanitized }
    }));
    // Re-run form-level validator since probability data lives outside the FormGroup.
    this.form.updateValueAndValidity();
  }
}
