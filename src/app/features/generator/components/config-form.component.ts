import { Component, inject, HostListener, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { RandomizationConfig } from '../../../models/randomization.model';
import { GeneratorStateService } from '../../../core/services/generator-state.service';

@Component({
  selector: 'app-config-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './config-form.component.html'
})
export class ConfigFormComponent {
  private fb = inject(FormBuilder);
  private eRef = inject(ElementRef);
  private state = inject(GeneratorStateService);

  form: FormGroup = this.fb.group({
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
  }, { validators: this.validateBlockSizes.bind(this) });

  strataCombinations: string[][] = [];

  dropdownOpen = false;

  presets = {
    simple: {
      protocolId: 'SIMP-001',
      studyName: 'Simple Unstratified Trial',
      phase: 'Phase I',
      arms: [
        { id: 'A', name: 'Treatment', ratio: 1 },
        { id: 'B', name: 'Control', ratio: 1 }
      ],
      strata: [],
      sitesStr: 'Site A, Site B',
      blockSizesStr: '2, 4',
      subjectIdMask: '[SiteID]-[001]'
    },
    standard: {
      protocolId: 'STD-002',
      studyName: 'Standard Stratified Trial',
      phase: 'Phase II',
      arms: [
        { id: 'A', name: 'Active', ratio: 1 },
        { id: 'B', name: 'Placebo', ratio: 1 }
      ],
      strata: [
        { id: 'age', name: 'Age Group', levelsStr: '<65, >=65' }
      ],
      sitesStr: '101, 102, 103',
      blockSizesStr: '4, 6',
      subjectIdMask: '[SiteID]-[StratumCode]-[001]'
    },
    complex: {
      protocolId: 'CMPX-003',
      studyName: 'Complex Multi-Strata Trial',
      phase: 'Phase III',
      arms: [
        { id: 'A', name: 'High Dose', ratio: 1 },
        { id: 'B', name: 'Low Dose', ratio: 1 },
        { id: 'C', name: 'Placebo', ratio: 1 }
      ],
      strata: [
        { id: 'age', name: 'Age Group', levelsStr: '<65, >=65' },
        { id: 'gender', name: 'Gender', levelsStr: 'M, F' },
        { id: 'region', name: 'Region', levelsStr: 'NA, EU' }
      ],
      sitesStr: 'US-01, US-02, UK-01, DE-01',
      blockSizesStr: '3, 6, 9',
      subjectIdMask: '[SiteID]-[StratumCode]-[001]'
    }
  };
  @ViewChild('dropdownContainer') dropdownContainer!: ElementRef;

  ngOnInit() {
    // Subscribe to changes in strata to dynamically compute stratumCaps form controls
    this.form.get('strata')?.valueChanges.subscribe(() => {
      this.updateStratumCaps();
    });
    // Trigger initial calculation
    this.updateStratumCaps();
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (this.dropdownOpen && this.dropdownContainer && !this.dropdownContainer.nativeElement.contains(event.target)) {
      this.dropdownOpen = false;
    }
  }

  get arms() { return this.form.get('arms') as FormArray; }
  get strata() { return this.form.get('strata') as FormArray; }
  get stratumCaps() { return this.form.get('stratumCaps') as FormArray; }

  loadPreset(type: 'simple' | 'standard' | 'complex') {
    const preset = this.presets[type];
    if (!preset) return;

    // Reset simple values
    this.form.patchValue({
      protocolId: preset.protocolId,
      studyName: preset.studyName,
      phase: preset.phase,
      sitesStr: preset.sitesStr,
      blockSizesStr: preset.blockSizesStr,
      subjectIdMask: preset.subjectIdMask,
      seed: ''
    }, { emitEvent: false });

    // Reset arms array
    this.arms.clear({ emitEvent: false });
    preset.arms.forEach(arm => {
      this.arms.push(this.fb.group({
        id: [arm.id],
        name: [arm.name],
        ratio: [arm.ratio, [Validators.required, Validators.min(1)]]
      }), { emitEvent: false });
    });

    // Reset strata array
    this.strata.clear({ emitEvent: false });
    preset.strata.forEach(stratum => {
      this.strata.push(this.fb.group({
        id: [stratum.id],
        name: [stratum.name],
        levelsStr: [stratum.levelsStr, Validators.required]
      }), { emitEvent: false });
    });

    // We only want to trigger the value changes ONCE after everything is reset
    // This allows the reactive listener on this.form.get('strata') to fire
    this.form.updateValueAndValidity();
    this.updateStratumCaps();
  }

  updateStratumCaps() {
    const strataVals = this.strata.value as {id: string, name: string, levelsStr: string}[];
    let combinations: string[][] = [];

    const validStrata = strataVals.filter(s => s.levelsStr && s.levelsStr.trim() !== '');

    if (validStrata.length === 0) {
      combinations = [[]]; // Default empty combination
    } else {
      const levelsList = validStrata.map(s =>
        s.levelsStr.split(',').map(l => l.trim()).filter(l => l)
      );

      // Cartesian product
      combinations = levelsList.reduce((acc, curr) => {
        const res: string[][] = [];
        for (const a of acc) {
          for (const c of curr) {
            res.push([...a, c]);
          }
        }
        return res;
      }, [[]] as string[][]);
    }

    this.strataCombinations = combinations;
    const currentCaps = this.stratumCaps.value as {levels: string[], cap: number}[];
    this.stratumCaps.clear();

    combinations.forEach(combo => {
      // Try to preserve existing cap value if combo matches
      const existing = currentCaps.find(c => c.levels.join('|') === combo.join('|'));
      const capValue = existing ? existing.cap : 20;

      this.stratumCaps.push(this.fb.group({
        levels: [combo],
        cap: [capValue, [Validators.required, Validators.min(1)]]
      }));
    });
  }

  get totalRatio() {
    return this.arms.controls.reduce((sum, control) => sum + (control.get('ratio')?.value || 0), 0);
  }

  parseCommaSeparated(value: string | null | undefined): string[] {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  addArm() {
    const id = String.fromCharCode(65 + this.arms.length);
    this.arms.push(this.fb.group({ id: [id], name: [''], ratio: [1, [Validators.required, Validators.min(1)]] }));
    this.form.updateValueAndValidity();
  }

  removeArm(index: number) {
    if (this.arms.length > 2) {
      this.arms.removeAt(index);
      this.form.updateValueAndValidity();
    }
  }

  addStratum() {
    const id = 'stratum_' + Date.now();
    this.strata.push(this.fb.group({ id: [id], name: [''], levelsStr: ['', Validators.required] }));
  }

  removeStratum(index: number) {
    this.strata.removeAt(index);
  }

  validateBlockSizes(group: FormGroup) {
    const arms = group.get('arms') as FormArray;
    const blockSizesStr = group.get('blockSizesStr')?.value;

    if (!arms || !blockSizesStr) return null;

    const totalRatio = arms.controls.reduce((sum, control) => sum + (control.get('ratio')?.value || 0), 0);
    const blockSizes = blockSizesStr.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));

    for (const size of blockSizes) {
      if (size % totalRatio !== 0) {
        return { invalidBlockSize: true };
      }
    }
    return null;
  }

  private getConfig(): RandomizationConfig {
    const val = this.form.value;

    return {
      protocolId: val.protocolId,
      studyName: val.studyName,
      phase: val.phase,
      arms: val.arms,
      sites: val.sitesStr.split(',').map((s: string) => s.trim()).filter((s: string) => s),
      strata: val.strata.map((s: {id: string, name: string, levelsStr: string}) => ({
        id: s.id,
        name: s.name,
        levels: s.levelsStr.split(',').map((l: string) => l.trim()).filter((l: string) => l)
      })),
      blockSizes: val.blockSizesStr.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n)),
      stratumCaps: val.stratumCaps,
      seed: val.seed || undefined,
      subjectIdMask: val.subjectIdMask
    };
  }

  onGenerateCode(language: 'R' | 'SAS' | 'Python') {
    if (this.form.valid) {
      try {
        this.state.openCodeGenerator(this.getConfig(), language);
        this.dropdownOpen = false;
      } catch (e) {
        console.error('Error generating code config:', e);
        alert('Error generating code. Please check your configuration.');
      }
    }
  }

  onSubmit() {
    if (this.form.valid) {
      try {
        this.state.generateSchema(this.getConfig());
      } catch (e) {
        console.error('Error generating schema config:', e);
        alert('Error generating schema. Please check your configuration.');
      }
    }
  }
}
