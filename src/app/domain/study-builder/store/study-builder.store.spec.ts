import { TestBed } from '@angular/core/testing';
import { StudyBuilderStore } from './study-builder.store';

describe('StudyBuilderStore', () => {
  let store: InstanceType<typeof StudyBuilderStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(StudyBuilderStore);
  });

  // ── Creation & defaults ────────────────────────────────────────────────────

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should initialise with at least one default stratum', () => {
    expect(store.strata().length).toBeGreaterThan(0);
  });

  // ── strataCombinations (withComputed) ─────────────────────────────────────

  it('should compute [[]] when strata array is empty', () => {
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

  it('should compute 8 combinations for three strata with 2 levels each', () => {
    store.setStrata([
      { id: 'a', name: 'A', levelsStr: 'A1, A2' },
      { id: 'b', name: 'B', levelsStr: 'B1, B2' },
      { id: 'c', name: 'C', levelsStr: 'C1, C2' }
    ]);
    expect(store.strataCombinations().length).toBe(8);
  });

  it('should ignore strata whose levelsStr is empty', () => {
    store.setStrata([
      { id: 'age', name: 'Age', levelsStr: '<65, >=65' },
      { id: 'empty', name: 'Empty', levelsStr: '' }
    ]);
    expect(store.strataCombinations()).toEqual([['<65'], ['>=65']]);
  });

  it('should ignore strata whose levelsStr contains only whitespace', () => {
    store.setStrata([
      { id: 'age', name: 'Age', levelsStr: '<65, >=65' },
      { id: 'blank', name: 'Blank', levelsStr: '   ' }
    ]);
    expect(store.strataCombinations()).toEqual([['<65'], ['>=65']]);
  });

  it('should trim whitespace from individual levels', () => {
    store.setStrata([{ id: 'sex', name: 'Sex', levelsStr: ' M , F ' }]);
    expect(store.strataCombinations()).toEqual([['M'], ['F']]);
  });

  it('should update strataCombinations reactively when setStrata is called again', () => {
    store.setStrata([{ id: 'a', name: 'A', levelsStr: 'X, Y' }]);
    expect(store.strataCombinations().length).toBe(2);

    store.setStrata([{ id: 'a', name: 'A', levelsStr: 'X, Y, Z' }]);
    expect(store.strataCombinations().length).toBe(3);
  });

  // ── Presets ────────────────────────────────────────────────────────────────

  it('should return the "simple" preset with correct structure', () => {
    const preset = store.getPreset('simple');
    expect(preset.protocolId).toBe('SIMP-001');
    expect(preset.arms.length).toBe(2);
    expect(preset.strata.length).toBe(0);
  });

  it('should return the "standard" preset with one stratum', () => {
    const preset = store.getPreset('standard');
    expect(preset.protocolId).toBe('STD-002');
    expect(preset.strata.length).toBe(1);
    expect(preset.arms.length).toBe(2);
  });

  it('should return the "complex" preset with 3 arms and 3 strata', () => {
    const preset = store.getPreset('complex');
    expect(preset.protocolId).toBe('CMPX-003');
    expect(preset.arms.length).toBe(3);
    expect(preset.strata.length).toBe(3);
  });

  it('each preset should include at least one block size in blockSizesStr', () => {
    for (const key of ['simple', 'standard', 'complex'] as const) {
      const preset = store.getPreset(key);
      expect(preset.blockSizesStr).toBeTruthy();
    }
  });

  it('each preset should include at least one site in sitesStr', () => {
    for (const key of ['simple', 'standard', 'complex'] as const) {
      const preset = store.getPreset(key);
      expect(preset.sitesStr).toBeTruthy();
    }
  });

  // ── buildConfig ───────────────────────────────────────────────────────────

  it('should build a RandomizationConfig from a minimal form value', () => {
    const config = store.buildConfig({
      protocolId: 'X-001',
      studyName: 'X Study',
      phase: 'Phase III',
      arms: [{ id: 'A', name: 'Active', ratio: 1 }, { id: 'B', name: 'Placebo', ratio: 1 }],
      strata: [{ id: 'age', name: 'Age', levelsStr: '<65, >=65' }],
      sitesStr: '101, 102',
      blockSizesStr: '4, 6',
      stratumCaps: [{ levels: ['<65'], cap: 10 }, { levels: ['>=65'], cap: 10 }],
      seed: 'abc',
      subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX',
      globalCap: 100,
      levelDetails: {}
    });

    expect(config.protocolId).toBe('X-001');
    expect(config.sites).toEqual(['101', '102']);
    expect(config.blockSizes).toEqual([4, 6]);
    expect(config.strata[0].levels).toEqual(['<65', '>=65']);
    expect(config.seed).toBe('abc');
  });

  it('should convert stratum levelsStr to a levels array in buildConfig', () => {
    const config = store.buildConfig({
      protocolId: 'S-001',
      studyName: 'S',
      phase: 'I',
      arms: [],
      strata: [{ id: 's', name: 'S', levelsStr: 'A, B, C' }],
      sitesStr: 'S1',
      blockSizesStr: '4',
      stratumCaps: [],
      seed: '',
      subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX',
      globalCap: 100,
      levelDetails: {}
    });
    expect(config.strata[0].levels).toEqual(['A', 'B', 'C']);
  });

  it('should trim sites and block sizes in buildConfig', () => {
    const config = store.buildConfig({
      protocolId: 'T',
      studyName: 'T',
      phase: 'I',
      arms: [],
      strata: [],
      sitesStr: '  Site A  ,  Site B  ',
      blockSizesStr: '  4  ,  6  ',
      stratumCaps: [],
      seed: '',
      subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX',
      globalCap: 100,
      levelDetails: {}
    });
    expect(config.sites).toEqual(['Site A', 'Site B']);
    expect(config.blockSizes).toEqual([4, 6]);
  });

  it('should filter out empty segments from sitesStr', () => {
    const config = store.buildConfig({
      protocolId: 'T',
      studyName: 'T',
      phase: 'I',
      arms: [],
      strata: [],
      sitesStr: 'S1,,S2',
      blockSizesStr: '4',
      stratumCaps: [],
      seed: '',
      subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX',
      globalCap: 100,
      levelDetails: {}
    });
    expect(config.sites).toEqual(['S1', 'S2']);
  });

  // ── buildConfig – block strategy ─────────────────────────────────────────

  it('buildConfig sets globalBlockStrategy from blockSizesStr and RANDOM_POOL default', () => {
    const config = store.buildConfig({
      protocolId: 'BS-001', studyName: 'BS', phase: 'I',
      arms: [], strata: [], sitesStr: 'S1', blockSizesStr: '4, 6',
      stratumCaps: [], seed: '', subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX', globalCap: 100, levelDetails: {}
    });
    expect(config.globalBlockStrategy).toEqual({ selectionType: 'RANDOM_POOL', sizes: [4, 6] });
  });

  it('buildConfig sets globalBlockStrategy with FIXED_SEQUENCE when blockSelectionType is set', () => {
    const config = store.buildConfig({
      protocolId: 'BS-002', studyName: 'BS', phase: 'I',
      arms: [], strata: [], sitesStr: 'S1', blockSizesStr: '4, 6',
      stratumCaps: [], seed: '', subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX', globalCap: 100, levelDetails: {},
      blockSelectionType: 'FIXED_SEQUENCE'
    });
    expect(config.globalBlockStrategy?.selectionType).toBe('FIXED_SEQUENCE');
    expect(config.globalBlockStrategy?.sizes).toEqual([4, 6]);
  });

  it('buildConfig maps site block overrides correctly', () => {
    const config = store.buildConfig({
      protocolId: 'BS-003', studyName: 'BS', phase: 'I',
      arms: [], strata: [], sitesStr: 'S1, S2', blockSizesStr: '4',
      stratumCaps: [], seed: '', subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX', globalCap: 100, levelDetails: {},
      blockOverrides: [
        { targetType: 'site', targetId: 'S1', sizesStr: '2, 4', selectionType: 'RANDOM_POOL' }
      ]
    });
    expect(config.siteBlockOverrides?.['S1']).toEqual({ selectionType: 'RANDOM_POOL', sizes: [2, 4] });
    expect(config.stratumBlockOverrides).toBeUndefined();
  });

  it('buildConfig maps stratum block overrides correctly', () => {
    const config = store.buildConfig({
      protocolId: 'BS-004', studyName: 'BS', phase: 'I',
      arms: [], strata: [], sitesStr: 'S1', blockSizesStr: '4',
      stratumCaps: [], seed: '', subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX', globalCap: 100, levelDetails: {},
      blockOverrides: [
        { targetType: 'stratum', targetId: '<65', sizesStr: '4, 6', selectionType: 'FIXED_SEQUENCE' }
      ]
    });
    expect(config.stratumBlockOverrides?.['<65']).toEqual({ selectionType: 'FIXED_SEQUENCE', sizes: [4, 6] });
  });

  it('buildConfig ignores overrides with no targetId', () => {
    const config = store.buildConfig({
      protocolId: 'BS-005', studyName: 'BS', phase: 'I',
      arms: [], strata: [], sitesStr: 'S1', blockSizesStr: '4',
      stratumCaps: [], seed: '', subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX', globalCap: 100, levelDetails: {},
      blockOverrides: [
        { targetType: 'site', targetId: '', sizesStr: '4', selectionType: 'RANDOM_POOL' }
      ]
    });
    expect(config.siteBlockOverrides).toBeUndefined();
  });

  it('buildConfig ignores overrides with empty sizes', () => {
    const config = store.buildConfig({
      protocolId: 'BS-006', studyName: 'BS', phase: 'I',
      arms: [], strata: [], sitesStr: 'S1', blockSizesStr: '4',
      stratumCaps: [], seed: '', subjectIdMask: '[SiteID]-[001]',
      capStrategy: 'MANUAL_MATRIX', globalCap: 100, levelDetails: {},
      blockOverrides: [
        { targetType: 'site', targetId: 'S1', sizesStr: '', selectionType: 'RANDOM_POOL' }
      ]
    });
    expect(config.siteBlockOverrides).toBeUndefined();
  });
});
