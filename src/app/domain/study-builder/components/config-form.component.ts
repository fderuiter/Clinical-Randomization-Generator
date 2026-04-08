import { Component, DestroyRef, ElementRef, HostListener, inject, OnInit, ViewChild, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { debounceTime } from 'rxjs/operators';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { StudyBuilderStore, StratumFormValue } from '../store/study-builder.store';
import { TagInputComponent } from './tag-input.component';
import { ConfigStorageService, StoredDraft } from '../../../core/services/config-storage.service';
import { APP_VERSION } from '../../../../environments/version';

@Component({
  selector: 'app-config-form',
  standalone: true,
  imports: [ReactiveFormsModule, CdkDropList, CdkDrag, CdkDragHandle, TagInputComponent, DatePipe],
  templateUrl: './config-form.component.html'
})
export class ConfigFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly facade = inject(RandomizationEngineFacade);
  readonly store = inject(StudyBuilderStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = inject(ConfigStorageService);

  dropdownOpen = false;
  draftBannerVisible = signal(false);
  draftSavedAt = signal<string | null>(null);

  @ViewChild('dropdownContainer') dropdownContainer!: ElementRef;
  @ViewChild('importFileInput') importFileInput!: ElementRef<HTMLInputElement>;

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
      subjectIdMask: ['[SiteID]-[StratumCode]-[001]', Validators.required]
    },
    { validators: this.blockSizesValidator.bind(this) }
  );

  ngOnInit(): void {
    // Check for a stored draft on initialization
    const draft = this.storage.loadDraft();
    if (draft) {
      this.draftSavedAt.set(draft.savedAt);
      this.draftBannerVisible.set(true);
    }

    this.form.get('strata')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s: StratumFormValue[]) => { this.store.setStrata(s); this.syncStratumCaps(); });
    this.store.setStrata(this.strata.value as StratumFormValue[]);
    this.syncStratumCaps();
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.facade.clearResults());

    // Auto-save pipeline: debounced write to localStorage
    this.form.valueChanges
      .pipe(
        debounceTime(1000),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.storage.saveDraft(this.extractDraftConfig()));
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

  // ── Draft Restore/Discard ──────────────────────────────────────────────────

  restoreDraft(): void {
    const draft = this.storage.loadDraft();
    if (!draft) return;
    this.applyDraftConfig(draft);
    this.draftBannerVisible.set(false);
  }

  discardDraft(): void {
    this.storage.clearDraft();
    this.draftBannerVisible.set(false);
  }

  // ── JSON Export ────────────────────────────────────────────────────────────

  exportConfig(): void {
    const payload = {
      schemaVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      config: this.extractDraftConfig()
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const protocolId = this.form.get('protocolId')?.value || 'config';
    a.href = url;
    a.download = `config_${protocolId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── JSON Import ────────────────────────────────────────────────────────────

  triggerImport(): void {
    this.importFileInput?.nativeElement.click();
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        // Structural validation
        const cfg = parsed?.config ?? parsed;
        if (
          !Array.isArray(cfg?.arms) ||
          !Array.isArray(cfg?.strata) ||
          !Array.isArray(cfg?.stratumCaps) ||
          typeof cfg?.protocolId !== 'string' ||
          typeof cfg?.sitesStr !== 'string'
        ) {
          alert('Invalid configuration file. The file does not contain the expected structure (arms, strata, stratumCaps).');
          return;
        }

        this.applyDraftConfig({ savedAt: new Date().toISOString(), schemaVersion: parsed.schemaVersion ?? '', config: cfg });
        this.draftBannerVisible.set(false);
      } catch {
        alert('Unable to parse the selected file. Please select a valid JSON configuration file.');
      } finally {
        // Reset the input so the same file can be re-imported
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private extractDraftConfig() {
    const v = this.form.value;
    return {
      protocolId: v.protocolId ?? '',
      studyName: v.studyName ?? '',
      phase: v.phase ?? '',
      arms: (v.arms ?? []) as { id: string; name: string; ratio: number }[],
      strata: (v.strata ?? []) as { id: string; name: string; levelsStr: string }[],
      sitesStr: v.sitesStr ?? '',
      blockSizesStr: v.blockSizesStr ?? '',
      stratumCaps: (v.stratumCaps ?? []) as { levels: string[]; cap: number }[],
      seed: v.seed ?? '',
      subjectIdMask: v.subjectIdMask ?? ''
    };
  }

  private applyDraftConfig(draft: StoredDraft): void {
    const cfg = draft.config;
    this.form.patchValue({
      protocolId: cfg.protocolId,
      studyName: cfg.studyName,
      phase: cfg.phase,
      sitesStr: cfg.sitesStr,
      blockSizesStr: cfg.blockSizesStr,
      seed: cfg.seed,
      subjectIdMask: cfg.subjectIdMask
    }, { emitEvent: false });

    this.arms.clear({ emitEvent: false });
    (cfg.arms ?? []).forEach((a: { id: string; name: string; ratio: number }) =>
      this.arms.push(
        this.fb.group({ id: [a.id], name: [a.name], ratio: [a.ratio, [Validators.required, Validators.min(1)]] }),
        { emitEvent: false }
      )
    );

    this.strata.clear({ emitEvent: false });
    (cfg.strata ?? []).forEach((s: { id: string; name: string; levelsStr: string }) =>
      this.strata.push(
        this.fb.group({ id: [s.id], name: [s.name], levelsStr: [s.levelsStr, Validators.required] }),
        { emitEvent: false }
      )
    );

    this.form.updateValueAndValidity();
    this.store.setStrata(this.strata.value as StratumFormValue[]);
    this.syncStratumCaps();

    // Rebuild stratumCaps with saved cap values
    if (cfg.stratumCaps?.length) {
      const savedCaps = cfg.stratumCaps as { levels: string[]; cap: number }[];
      const capsArray = this.stratumCaps;
      for (let i = 0; i < capsArray.length; i++) {
        const key = (capsArray.at(i).get('levels')?.value as string[]).join('|');
        const saved = savedCaps.find(c => c.levels.join('|') === key);
        if (saved) {
          capsArray.at(i).get('cap')?.setValue(saved.cap, { emitEvent: false });
        }
      }
    }
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
