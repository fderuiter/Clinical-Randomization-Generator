import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { RandomizationConfig } from '../../core/models/randomization.model';

// ---------------------------------------------------------------------------
// Types used internally by the store
// ---------------------------------------------------------------------------

export interface StratumFormValue {
  id: string;
  name: string;
  levelsStr: string;
}

export interface ArmFormValue {
  id: string;
  name: string;
  ratio: number;
}

export interface StudyBuilderFormValue {
  protocolId: string;
  studyName: string;
  phase: string;
  arms: ArmFormValue[];
  strata: StratumFormValue[];
  sitesStr: string;
  blockSizesStr: string;
  stratumCaps: { levels: string[]; cap: number }[];
  seed: string;
  subjectIdMask: string;
}

interface StudyBuilderState {
  strata: StratumFormValue[];
}

// ---------------------------------------------------------------------------
// Static preset definitions (moved out of the component)
// ---------------------------------------------------------------------------

export interface PresetConfig {
  protocolId: string;
  studyName: string;
  phase: string;
  arms: ArmFormValue[];
  strata: StratumFormValue[];
  sitesStr: string;
  blockSizesStr: string;
  subjectIdMask: string;
}

const PRESETS: Record<'simple' | 'standard' | 'complex', PresetConfig> = {
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
    strata: [{ id: 'age', name: 'Age Group', levelsStr: '<65, >=65' }],
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

// ---------------------------------------------------------------------------
// StudyBuilderStore
// ---------------------------------------------------------------------------

/**
 * NgRx SignalStore responsible for study-builder form state and derivations.
 *
 * Responsibilities:
 *  - Holding the current strata signal so Cartesian products can be derived
 *    reactively via `withComputed` instead of imperatively in the component.
 *  - Owning preset definitions and exposing a `getPreset()` method so the
 *    component has no hard-coded configuration data.
 *  - Providing `buildConfig()` to convert raw form values into a typed
 *    `RandomizationConfig` object, keeping that logic out of the component.
 */
export const StudyBuilderStore = signalStore(
  { providedIn: 'root' },

  withState<StudyBuilderState>({
    strata: [{ id: 'age', name: 'Age Group', levelsStr: '<65, >=65' }]
  }),

  withComputed(({ strata }) => ({
    /**
     * Cartesian product of all stratum levels.  Updates automatically whenever
     * the `strata` signal changes, replacing the manual `updateStratumCaps()`
     * call that previously lived inside `ConfigFormComponent`.
     */
    strataCombinations: computed<string[][]>(() => {
      const strataVals = strata();
      const validStrata = strataVals.filter(s => s.levelsStr && s.levelsStr.trim() !== '');

      if (validStrata.length === 0) {
        return [[]]; // single "overall / default" combination
      }

      const levelsList = validStrata.map(s =>
        s.levelsStr
          .split(',')
          .map(l => l.trim())
          .filter(l => l)
      );

      return levelsList.reduce<string[][]>((acc, curr) => {
        const result: string[][] = [];
        for (const a of acc) {
          for (const c of curr) {
            result.push([...a, c]);
          }
        }
        return result;
      }, [[]]);
    })
  })),

  withMethods(store => ({
    /**
     * Synchronise the strata signal from the current FormArray value so that
     * `strataCombinations` reacts to user edits.
     */
    setStrata(strata: StratumFormValue[]): void {
      patchState(store, { strata });
    },

    /** Returns a preset configuration by name. */
    getPreset(type: 'simple' | 'standard' | 'complex'): PresetConfig {
      return PRESETS[type];
    },

    /**
     * Converts raw reactive-form values into a strongly-typed
     * `RandomizationConfig` suitable for passing to the randomization engine.
     */
    buildConfig(formValue: StudyBuilderFormValue): RandomizationConfig {
      return {
        protocolId: formValue.protocolId,
        studyName: formValue.studyName,
        phase: formValue.phase,
        arms: formValue.arms,
        sites: formValue.sitesStr
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s),
        strata: formValue.strata.map((s: StratumFormValue) => ({
          id: s.id,
          name: s.name,
          levels: s.levelsStr
            .split(',')
            .map((l: string) => l.trim())
            .filter((l: string) => l)
        })),
        blockSizes: formValue.blockSizesStr
          .split(',')
          .map((s: string) => parseInt(s.trim(), 10))
          .filter((n: number) => !isNaN(n)),
        stratumCaps: formValue.stratumCaps,
        seed: formValue.seed || '',
        subjectIdMask: formValue.subjectIdMask
      };
    }
  }))
);
