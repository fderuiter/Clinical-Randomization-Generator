import { Component, EventEmitter, Output, inject, HostListener, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { RandomizationConfig } from './randomization.service';

@Component({
  selector: 'app-config-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      
      <div class="mb-2 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md">
        <div class="flex flex-col sm:flex-row sm:items-start">
          <div class="flex-shrink-0 mt-0.5">
            <svg class="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3 w-full">
            <h3 class="text-sm font-medium text-blue-800">Study-Agnostic Randomization Presets</h3>
            <div class="mt-2 text-sm text-blue-700">
              <p>Start from scratch or quickly toggle between different strata and complexity options.</p>
            </div>
            <!-- Preset Buttons -->
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <span class="text-sm font-semibold text-blue-900">Load Preset:</span>
              <button type="button" (click)="loadPreset('simple')" class="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-white hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors">
                Simple (Unstratified)
              </button>
              <button type="button" (click)="loadPreset('standard')" class="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-white hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors">
                Standard (1 Stratum)
              </button>
              <button type="button" (click)="loadPreset('complex')" class="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-white hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors">
                Complex (Multi-strata)
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Study Metadata -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Study Metadata</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="protocolId" class="block text-sm font-medium text-gray-700 mb-1">Protocol ID</label>
            <input id="protocolId" type="text" formControlName="protocolId" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border">
          </div>
          <div>
            <label for="studyName" class="block text-sm font-medium text-gray-700 mb-1">Study Name</label>
            <input id="studyName" type="text" formControlName="studyName" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border">
          </div>
          <div>
            <label for="phase" class="block text-sm font-medium text-gray-700 mb-1">Phase</label>
            <select id="phase" formControlName="phase" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border bg-white">
              <option value="I">Phase I</option>
              <option value="II">Phase II</option>
              <option value="III">Phase III</option>
              <option value="IV">Phase IV</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Treatment Arms -->
      <section>
        <div class="flex justify-between items-center mb-4 border-b pb-2">
          <h2 class="text-lg font-semibold text-gray-900">Treatment Arms</h2>
          <button type="button" (click)="addArm()" class="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-md hover:bg-indigo-100 font-medium transition-colors">
            + Add Arm
          </button>
        </div>
        <div formArrayName="arms" class="space-y-3">
          @for (arm of arms.controls; track $index) {
            <div [formGroupName]="$index" class="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div class="flex-1">
                <input type="text" formControlName="name" placeholder="Arm Name (e.g., Placebo)" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border">
              </div>
              <div class="w-32">
                <input type="number" formControlName="ratio" placeholder="Ratio" min="1" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border">
              </div>
              <button type="button" (click)="removeArm($index)" [disabled]="arms.length <= 2" class="text-red-500 hover:text-red-700 p-2 disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          }
        </div>
      </section>

      <!-- Stratification Factors -->
      <section>
        <div class="flex justify-between items-center mb-4 border-b pb-2">
          <h2 class="text-lg font-semibold text-gray-900">Stratification Factors</h2>
          <button type="button" (click)="addStratum()" class="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-md hover:bg-indigo-100 font-medium transition-colors">
            + Add Factor
          </button>
        </div>
        <div formArrayName="strata" class="space-y-4">
          @if (strata.length === 0) {
            <p class="text-sm text-gray-500 italic">No stratification factors defined. Randomization will be unstratified.</p>
          }
          @for (stratum of strata.controls; track $index) {
            <div [formGroupName]="$index" class="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div class="flex justify-between items-start mb-3">
                <div class="flex-1 mr-4">
                  <input type="text" formControlName="name" placeholder="Factor Name (e.g., Age Group)" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border">
                </div>
                <button type="button" (click)="removeStratum($index)" class="text-red-500 hover:text-red-700 p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
              <div class="pl-4 border-l-2 border-indigo-200">
                <label [for]="'levelsStr' + $index" class="block text-xs font-medium text-gray-500 mb-1">Levels (comma-separated)</label>
                <input [id]="'levelsStr' + $index" type="text" formControlName="levelsStr" placeholder="e.g., <65, >=65" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border">
                <div class="mt-2 flex flex-wrap gap-2">
                  @for (level of parseCommaSeparated(stratum.get('levelsStr')?.value); track level) {
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{{level}}</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Sites & Blocks -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Sites & Blocks</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="sitesStr" class="block text-sm font-medium text-gray-700 mb-1">Sites (comma-separated IDs)</label>
            <textarea id="sitesStr" formControlName="sitesStr" rows="3" placeholder="e.g., 101, 102, 103" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border"></textarea>
            <div class="mt-2 flex flex-wrap gap-2">
              @for (site of parseCommaSeparated(form.get('sitesStr')?.value); track site) {
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{{site}}</span>
              }
            </div>
          </div>
          <div class="space-y-4">
            <div>
              <label for="blockSizesStr" class="block text-sm font-medium text-gray-700 mb-1">Block Sizes (comma-separated)</label>
              <input id="blockSizesStr" type="text" formControlName="blockSizesStr" placeholder="e.g., 4, 6" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border">
              <div class="mt-2 flex flex-wrap gap-2">
                @for (size of parseCommaSeparated(form.get('blockSizesStr')?.value); track size) {
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{{size}}</span>
                }
              </div>
              @if (form.errors?.['invalidBlockSize']) {
                <p class="text-xs text-red-600 mt-1">Block sizes must be multiples of the total treatment ratio ({{totalRatio}}).</p>
              }
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Max Subjects per Stratum</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" formArrayName="stratumCaps">
                @for (capControl of stratumCaps.controls; track i; let i = $index) {
                  <div [formGroupName]="i" class="flex flex-col p-3 border border-gray-200 rounded-md bg-gray-50">
                    <span class="text-xs font-semibold text-gray-600 mb-1 truncate" [title]="capControl.get('levels')?.value.join(' | ')">
                      {{ capControl.get('levels')?.value.join(' | ') || 'Overall / Default' }}
                    </span>
                    <input type="number" formControlName="cap" min="1" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-1.5 border" placeholder="Max subjects">
                  </div>
                }
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label for="seed" class="block text-sm font-medium text-gray-700 mb-1">Random Seed (Optional)</label>
                <input id="seed" type="text" formControlName="seed" placeholder="Auto-generated if empty" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border">
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Advanced -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Advanced</h2>
        <div>
          <label for="subjectIdMask" class="block text-sm font-medium text-gray-700 mb-1">Subject ID Mask</label>
          <input id="subjectIdMask" type="text" formControlName="subjectIdMask" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base px-4 py-2.5 border font-mono">
          <p class="text-xs text-gray-500 mt-1">Use [SiteID], [StratumCode], and [001] for padding.</p>
        </div>
      </section>

      <div class="pt-4 border-t flex justify-end gap-3">
        <div class="relative inline-block text-left" #dropdownContainer>
          <button type="button" (click)="dropdownOpen = !dropdownOpen" [disabled]="!form.valid" class="bg-white border border-indigo-200 text-indigo-700 px-6 py-2 rounded-md hover:bg-indigo-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Generate Code
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          @if (dropdownOpen) {
            <div class="origin-bottom-right absolute right-0 bottom-full mb-2 w-40 rounded-md shadow-lg bg-white ring-1 ring-black/5 focus:outline-none z-10">
              <div class="py-1" role="menu" aria-orientation="vertical">
                <button type="button" (click)="onGenerateCode('R')" class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900" role="menuitem">R Script</button>
                <button type="button" (click)="onGenerateCode('SAS')" class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900" role="menuitem">SAS Script</button>
                <button type="button" (click)="onGenerateCode('Python')" class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900" role="menuitem">Python Script</button>
              </div>
            </div>
          }
        </div>
        <button type="submit" [disabled]="!form.valid" class="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
          Generate Schema
        </button>
      </div>
    </form>
  `
})
export class ConfigFormComponent {
  private fb = inject(FormBuilder);
  private eRef = inject(ElementRef);
  
  @Output() generate = new EventEmitter<RandomizationConfig>();
  @Output() generateCode = new EventEmitter<{config: RandomizationConfig, language: 'R' | 'SAS' | 'Python'}>();

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
        this.generateCode.emit({config: this.getConfig(), language});
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
        this.generate.emit(this.getConfig());
      } catch (e) {
        console.error('Error generating schema config:', e);
        alert('Error generating schema. Please check your configuration.');
      }
    }
  }
}
