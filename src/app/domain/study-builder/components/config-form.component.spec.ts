/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfigFormComponent } from './config-form.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { StudyBuilderStore } from '../store/study-builder.store';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('ConfigFormComponent (domain)', () => {
  let component: ConfigFormComponent;
  let fixture: ComponentFixture<ConfigFormComponent>;
  let mockFacade: unknown;

  beforeEach(async () => {
    mockFacade = {
      config: signal(null),
      results: signal(null),
      isGenerating: signal(false),
      error: signal(null),
      showCodeGenerator: signal(false),
      codeLanguage: signal('R'),
      generateSchema: vi.fn(),
      openCodeGenerator: vi.fn(),
      closeCodeGenerator: vi.fn(),
      clearResults: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, ConfigFormComponent],
      providers: [
        { provide: RandomizationEngineFacade, useValue: mockFacade },
        StudyBuilderStore
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should generate valid distinct stratum caps controls based on combinations', () => {
    component.addStratum();
    const strataArray = component.strata;

    strataArray.at(0).get('id')?.setValue('age');
    strataArray.at(0).get('levelsStr')?.setValue('<65, >=65');

    strataArray.at(1).get('id')?.setValue('gender');
    strataArray.at(1).get('levelsStr')?.setValue('M, F');

    component.syncStratumCaps();

    const capsArray = component.stratumCaps;
    expect(capsArray.length).toBe(4);

    const values = capsArray.value;
    expect(values[0].levels).toEqual(['<65', 'M']);
    expect(values[1].levels).toEqual(['<65', 'F']);
    expect(values[2].levels).toEqual(['>=65', 'M']);
    expect(values[3].levels).toEqual(['>=65', 'F']);
  });

  it('should load simple preset', () => {
    component.loadPreset('simple');

    expect(component.form.get('metadataGroup.protocolId')?.value).toBe('SIMP-001');
    expect(component.arms.length).toBe(2);
    expect(component.strata.length).toBe(0);
    expect(component.stratumCaps.length).toBe(1); // Default cap (no strata)
  });

  it('should load complex preset', () => {
    component.loadPreset('complex');

    expect(component.form.get('metadataGroup.protocolId')?.value).toBe('CMPX-003');
    expect(component.arms.length).toBe(3);
    expect(component.strata.length).toBe(3);
    expect(component.stratumCaps.length).toBe(8); // 2 * 2 * 2 = 8 combinations
  });

  it('should set correct arm names and ratios after loading the complex preset', () => {
    component.loadPreset('complex');

    const armsValue = component.arms.value as { id: string; name: string; ratio: number }[];
    expect(armsValue[0].name).toBe('High Dose');
    expect(armsValue[1].name).toBe('Low Dose');
    expect(armsValue[2].name).toBe('Placebo');
    armsValue.forEach(a => expect(a.ratio).toBe(1));
  });

  it('should overwrite all previous arm names when switching presets', () => {
    expect(component.arms.length).toBe(2);
    expect((component.arms.at(0).value as { name: string }).name).toBe('Active');

    component.loadPreset('complex');

    expect(component.arms.length).toBe(3);
    expect((component.arms.at(0).value as { name: string }).name).toBe('High Dose');
    expect((component.arms.at(1).value as { name: string }).name).toBe('Low Dose');
    expect((component.arms.at(2).value as { name: string }).name).toBe('Placebo');
  });

  it('should call clearResults() when a form field value changes', () => {
    component.form.get('metadataGroup.protocolId')?.setValue('NEW-ID');
    expect((mockFacade as any).clearResults).toHaveBeenCalled();
  });

  it('should load the standard preset correctly', () => {
    component.loadPreset('standard');

    expect(component.form.get('metadataGroup.protocolId')?.value).toBe('STD-002');
    expect(component.arms.length).toBe(2);
    expect(component.strata.length).toBe(1);
    expect(component.stratumCaps.length).toBe(2); // 2 age levels
  });

  describe('onSubmit()', () => {
    it('should call facade.generateSchema when the form is valid', () => {
      component.onSubmit();
      expect((mockFacade as any).generateSchema).toHaveBeenCalledTimes(1);
      const arg = (mockFacade as any).generateSchema.mock.calls[0][0];
      expect(arg.protocolId).toBe(component.form.get('metadataGroup.protocolId')?.value);
    });

    it('should NOT call facade.generateSchema when the form is invalid', () => {
      component.form.get('metadataGroup.protocolId')?.setValue('');
      component.onSubmit();
      expect((mockFacade as any).generateSchema).not.toHaveBeenCalled();
    });
  });

  describe('onGenerateCode()', () => {
    it('should call facade.openCodeGenerator with the correct language when the form is valid', () => {
      component.onGenerateCode('R');
      expect((mockFacade as any).openCodeGenerator).toHaveBeenCalledTimes(1);
      const [, lang] = (mockFacade as any).openCodeGenerator.mock.calls[0];
      expect(lang).toBe('R');
    });

    it('should pass SAS as the language when requested', () => {
      component.onGenerateCode('SAS');
      const [, lang] = (mockFacade as any).openCodeGenerator.mock.calls[0];
      expect(lang).toBe('SAS');
    });

    it('should pass Python as the language when requested', () => {
      component.onGenerateCode('Python');
      const [, lang] = (mockFacade as any).openCodeGenerator.mock.calls[0];
      expect(lang).toBe('Python');
    });

    it('should NOT call facade.openCodeGenerator when the form is invalid', () => {
      component.form.get('metadataGroup.protocolId')?.setValue('');
      component.onGenerateCode('Python');
      expect((mockFacade as any).openCodeGenerator).not.toHaveBeenCalled();
    });
  });

  describe('arm management', () => {
    it('should add a new arm when addArm() is called', () => {
      const before = component.arms.length;
      component.addArm();
      expect(component.arms.length).toBe(before + 1);
    });

    it('should remove an arm when removeArm() is called and there are more than 2 arms', () => {
      component.addArm();
      const before = component.arms.length;
      expect(before).toBeGreaterThan(2);
      component.removeArm(before - 1);
      expect(component.arms.length).toBe(before - 1);
    });

    it('should NOT remove an arm when there are exactly 2 arms', () => {
      expect(component.arms.length).toBe(2);
      component.removeArm(0);
      expect(component.arms.length).toBe(2);
    });

    it('should return the sum of all arm ratios from totalRatio', () => {
      expect(component.totalRatio).toBe(2);
      component.arms.at(0).get('ratio')?.setValue(3);
      expect(component.totalRatio).toBe(4);
    });

    it('should increment the ratio of an arm when incrementRatio() is called', () => {
      const before = component.arms.at(0).get('ratio')?.value as number;
      component.incrementRatio(0);
      expect(component.arms.at(0).get('ratio')?.value).toBe(before + 1);
    });

    it('should decrement the ratio of an arm when decrementRatio() is called and ratio > 1', () => {
      component.arms.at(0).get('ratio')?.setValue(3);
      component.decrementRatio(0);
      expect(component.arms.at(0).get('ratio')?.value).toBe(2);
    });

    it('should NOT decrement the ratio below 1', () => {
      component.arms.at(0).get('ratio')?.setValue(1);
      component.decrementRatio(0);
      expect(component.arms.at(0).get('ratio')?.value).toBe(1);
    });
  });

  describe('strata management', () => {
    it('should add a new stratum when addStratum() is called', () => {
      const before = component.strata.length;
      component.addStratum();
      expect(component.strata.length).toBe(before + 1);
    });

    it('should remove a stratum when removeStratum() is called', () => {
      component.addStratum();
      const before = component.strata.length;
      component.removeStratum(before - 1);
      expect(component.strata.length).toBe(before - 1);
    });

    it('should reorder strata via onStrataDrop()', () => {
      // Load complex preset: 3 strata – age, gender, region
      component.loadPreset('complex');
      const firstId = (component.strata.at(0).value as { id: string }).id;
      const secondId = (component.strata.at(1).value as { id: string }).id;

      // Simulate dragging index 0 to index 1
      component.onStrataDrop({ previousIndex: 0, currentIndex: 1 } as any);

      expect((component.strata.at(0).value as { id: string }).id).toBe(secondId);
      expect((component.strata.at(1).value as { id: string }).id).toBe(firstId);
    });

    it('should not recompute stratum caps immediately when reordering strata', () => {
      const markCapsStaleSpy = vi.spyOn(component as any, 'markCapsStale');
      component.loadPreset('complex');
      markCapsStaleSpy.mockClear();

      component.onStrataDrop({ previousIndex: 0, currentIndex: 1 } as any);

      expect(markCapsStaleSpy).toHaveBeenCalledOnce();
    });

    it('should not change strata when onStrataDrop() has equal indices', () => {
      component.loadPreset('standard');
      const snapshot = component.strata.value;
      component.onStrataDrop({ previousIndex: 0, currentIndex: 0 } as any);
      expect(component.strata.value).toEqual(snapshot);
    });

    it('should defer cap recomputation until the caps step is entered', () => {
      const initialCapsLength = component.stratumCaps.length;
      component.strata.at(0).get('levelsStr')?.setValue('<65, >=65, >=80');

      expect(component.stratumCaps.length).toBe(initialCapsLength);

      component.onStepSelectionChange({ selectedIndex: 4 } as any);
      expect(component.stratumCaps.length).toBe(3);
    });

    it('should show reset warning when returning to caps after strata changes', () => {
      component.onStepSelectionChange({ selectedIndex: 4 } as any);
      expect(component.capsResetWarning()).toBe(false);

      component.strata.at(0).get('levelsStr')?.setValue('<65, >=65, >=80');
      component.onStepSelectionChange({ selectedIndex: 4 } as any);

      expect(component.capsResetWarning()).toBe(true);
      expect(component.matrixComputed()).toBe(false);
    });

    it('should disable strata-step next when minimization probabilities are invalid', () => {
      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
      component.setMinimizationProbability('age', '<65', 60);
      component.setMinimizationProbability('age', '>=65', 30);
      component.form.updateValueAndValidity();

      expect(component.form.errors?.['minimizationProbabilitiesInvalid']).toBe(true);
      expect(component.isStrataStepNextDisabled).toBe(true);
    });

    it('should allow strata-step next when minimization probabilities are valid', () => {
      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
      component.setMinimizationProbability('age', '<65', 50);
      component.setMinimizationProbability('age', '>=65', 50);
      component.form.updateValueAndValidity();

      expect(component.form.errors?.['minimizationProbabilitiesInvalid']).toBeFalsy();
      expect(component.isStrataStepNextDisabled).toBe(false);
    });
  });

  describe('validateBlockSizes()', () => {
    it('should have no form errors when all block sizes are multiples of the total ratio', () => {
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
    });

    it('should set invalidBlockSize error when a block size is not a multiple of total ratio', () => {
      component.form.get('allocationGroup.blockSizesStr')?.setValue('3');
      component.form.updateValueAndValidity();
      expect(component.form.errors?.['invalidBlockSize']).toBe(true);
    });

    it('should clear the error once a valid block size is restored', () => {
      component.form.get('allocationGroup.blockSizesStr')?.setValue('3');
      component.form.updateValueAndValidity();
      expect(component.form.errors?.['invalidBlockSize']).toBe(true);

      component.form.get('allocationGroup.blockSizesStr')?.setValue('4');
      component.form.updateValueAndValidity();
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
    });

    it('should re-run the validator after loadPreset() changes the total arm ratio', () => {
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
      component.loadPreset('complex');
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
      expect(component.form.valid).toBe(true);
    });

    it('should detect an invalid block size immediately after preset loading changes the ratio', () => {
      component.loadPreset('complex');
      component.form.get('allocationGroup.blockSizesStr')?.setValue('4');
      component.form.updateValueAndValidity();
      expect(component.form.errors?.['invalidBlockSize']).toBe(true);
      expect(component.form.valid).toBe(false);
    });
  });

  describe('caps strategy state', () => {
    it('should switch to MANUAL_MATRIX and disable global cap after editing a computed cap', () => {
      component.form.get('capsGroup.capStrategy')?.setValue('PROPORTIONAL');
      component.setPercentage('age', '<65', 50);
      component.setPercentage('age', '>=65', 50);

      component.computeMatrix();
      expect(component.matrixComputed()).toBe(true);

      component.stratumCaps.at(0).get('cap')?.setValue(15);

      expect(component.form.get('capsGroup.capStrategy')?.value).toBe('MANUAL_MATRIX');
      expect(component.form.get('capsGroup.globalCap')?.disabled).toBe(true);
    });
  });

  describe('metadata fields', () => {
    it('should preserve seed and subjectIdMask values after metadata edits', () => {
      expect(component.form.get('metadataGroup.subjectIdMask')?.value).toBe('{SITE}-{STRATUM}-{SEQ:3}');
      component.form.get('metadataGroup.seed')?.setValue('my-custom-seed');
      component.form.get('metadataGroup.subjectIdMask')?.setValue('{SITE}-{SEQ:4}');

      expect(component.form.get('metadataGroup.seed')?.value).toBe('my-custom-seed');
      expect(component.form.get('metadataGroup.subjectIdMask')?.value).toBe('{SITE}-{SEQ:4}');
    });

    it('should keep the form valid after metadata field edits', () => {
      expect(component.form.valid).toBe(true);
      component.form.get('metadataGroup.seed')?.setValue('seed-42');
      component.form.get('metadataGroup.subjectIdMask')?.setValue('{SITE}-{STRATUM}-{SEQ:3}');
      expect(component.form.valid).toBe(true);
    });
  });
  describe('parseCommaSeparated()', () => {
    it('should parse a comma-separated string into a trimmed string array', () => {
      expect(component.parseCommaSeparated(' a, b , c ')).toEqual(['a', 'b', 'c']);
    });

    it('should return an empty array for null input', () => {
      expect(component.parseCommaSeparated(null)).toEqual([]);
    });

    it('should return an empty array for an empty string', () => {
      expect(component.parseCommaSeparated('')).toEqual([]);
    });

    it('should filter out empty segments created by consecutive commas', () => {
      expect(component.parseCommaSeparated('a,,b')).toEqual(['a', 'b']);
    });
  });
});
