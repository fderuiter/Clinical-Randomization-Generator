import { TestBed } from '@angular/core/testing';
import { StudyBuilderStore } from './study-builder.store';

describe('StudyBuilderStore', () => {
  let store: InstanceType<typeof StudyBuilderStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(StudyBuilderStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should initialise with the default strata', () => {
    expect(store.strata().length).toBeGreaterThan(0);
  });

  it('should compute a single [[]] combination when strata is empty', () => {
    store.setStrata([]);
    expect(store.strataCombinations()).toEqual([[]]);
  });

  it('should compute 2 combinations for one stratum with 2 levels', () => {
    store.setStrata([{ id: 'age', name: 'Age', levelsStr: '<65, >=65' }]);
    expect(store.strataCombinations()).toEqual([['<65'], ['>=65']]);
  });

  it('should compute 4 combinations for two strata with 2 levels each', () => {
    store.setStrata([
      { id: 'age', name: 'Age', levelsStr: '<65, >=65' },
      { id: 'gender', name: 'Gender', levelsStr: 'M, F' }
    ]);
    const combos = store.strataCombinations();
    expect(combos.length).toBe(4);
    expect(combos[0]).toEqual(['<65', 'M']);
    expect(combos[1]).toEqual(['<65', 'F']);
    expect(combos[2]).toEqual(['>=65', 'M']);
    expect(combos[3]).toEqual(['>=65', 'F']);
  });

  it('should ignore strata with empty levelsStr in combinations', () => {
    store.setStrata([
      { id: 'age', name: 'Age', levelsStr: '<65, >=65' },
      { id: 'empty', name: 'Empty', levelsStr: '' }
    ]);
    // Only the first stratum contributes
    expect(store.strataCombinations()).toEqual([['<65'], ['>=65']]);
  });

  it('should return the simple preset', () => {
    const preset = store.getPreset('simple');
    expect(preset.protocolId).toBe('SIMP-001');
    expect(preset.arms.length).toBe(2);
    expect(preset.strata.length).toBe(0);
  });

  it('should return the standard preset', () => {
    const preset = store.getPreset('standard');
    expect(preset.protocolId).toBe('STD-002');
    expect(preset.strata.length).toBe(1);
  });

  it('should return the complex preset', () => {
    const preset = store.getPreset('complex');
    expect(preset.protocolId).toBe('CMPX-003');
    expect(preset.arms.length).toBe(3);
    expect(preset.strata.length).toBe(3);
  });

  it('should build a RandomizationConfig from form values', () => {
    const formValue = {
      protocolId: 'X-001',
      studyName: 'X Study',
      phase: 'Phase III',
      arms: [{ id: 'A', name: 'Active', ratio: 1 }, { id: 'B', name: 'Placebo', ratio: 1 }],
      strata: [{ id: 'age', name: 'Age', levelsStr: '<65, >=65' }],
      sitesStr: '101, 102',
      blockSizesStr: '4, 6',
      stratumCaps: [{ levels: ['<65'], cap: 10 }, { levels: ['>=65'], cap: 10 }],
      seed: 'abc',
      subjectIdMask: '[SiteID]-[001]'
    };

    const config = store.buildConfig(formValue);
    expect(config.protocolId).toBe('X-001');
    expect(config.sites).toEqual(['101', '102']);
    expect(config.blockSizes).toEqual([4, 6]);
    expect(config.strata[0].levels).toEqual(['<65', '>=65']);
  });
});
