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
      runMonteCarlo: vi.fn(),
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

    it('should strip block-control payload when switching to minimization', () => {
      component.form.get('allocationGroup.blockSizesStr')?.setValue('4, 8');
      component.form.get('allocationGroup.blockSelectionType')?.setValue('FIXED_SEQUENCE');
      component.addBlockOverride();
      component.blockOverrides.at(0).patchValue({
        targetType: 'site',
        targetId: '101',
        sizesStr: '2, 4',
        selectionType: 'RANDOM_POOL'
      });

      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
      component.setMinimizationProbability('age', '<65', 50);
      component.setMinimizationProbability('age', '>=65', 50);
      component.form.updateValueAndValidity();

      component.onSubmit();

      const arg = (mockFacade as any).generateSchema.mock.calls.at(-1)?.[0];
      expect(arg.randomizationMethod).toBe('MINIMIZATION');
      expect(arg.globalBlockStrategy).toBeUndefined();
      expect(arg.siteBlockOverrides).toBeUndefined();
      expect(arg.stratumBlockOverrides).toBeUndefined();
      expect(arg.blockSizes).toEqual([]);
    });

    it('should only include minimization fields in raw form payload when method is MINIMIZATION', () => {
      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
      component.form.get('allocationGroup.minimizationP')?.setValue(0.85);
      component.form.get('allocationGroup.totalSampleSize')?.setValue(240);

      const formValue = (component as any).buildFormValue();

      expect(formValue.randomizationMethod).toBe('MINIMIZATION');
      expect(formValue.minimizationP).toBe(0.85);
      expect(formValue.totalSampleSize).toBe(240);
      expect(formValue.blockSizesStr).toBeUndefined();
      expect(formValue.blockSelectionType).toBeUndefined();
      expect(formValue.blockOverrides).toBeUndefined();
    });

    it('should only include block fields in raw form payload when method is BLOCK', () => {
      component.form.get('designGroup.randomizationMethod')?.setValue('BLOCK');
      component.form.get('allocationGroup.blockSizesStr')?.setValue('4, 6');
      component.form.get('allocationGroup.blockSelectionType')?.setValue('RANDOM_POOL');

      const formValue = (component as any).buildFormValue();

      expect(formValue.randomizationMethod).toBe('BLOCK');
      expect(formValue.blockSizesStr).toBe('4, 6');
      expect(formValue.blockSelectionType).toBe('RANDOM_POOL');
      expect(formValue.minimizationP).toBeUndefined();
      expect(formValue.totalSampleSize).toBeUndefined();
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

    it('should display inline validation error only when touched and invalid', () => {
      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');

      // Initially untouched
      expect(component.isMinimizationProbabilityTouched('age')).toBe(false);

      // Set to invalid
      component.setMinimizationProbability('age', '<65', 60);
      component.setMinimizationProbability('age', '>=65', 30);
      component.form.updateValueAndValidity();
      expect(component.isMinimizationProbabilityInvalid('age')).toBe(true);

      // Still untouched
      expect(component.isMinimizationProbabilityTouched('age')).toBe(false);

      // Trigger touched
      component.markMinimizationProbabilityTouched('age');
      expect(component.isMinimizationProbabilityTouched('age')).toBe(true);

      // Fix probabilities (valid)
      component.setMinimizationProbability('age', '<65', 50);
      component.setMinimizationProbability('age', '>=65', 50);
      component.form.updateValueAndValidity();
      expect(component.isMinimizationProbabilityInvalid('age')).toBe(false);
    });

    it('should immediately invalidate the form when strata sync makes minimization totals stale', () => {
      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
      component.setMinimizationProbability('age', '<65', 50);
      component.setMinimizationProbability('age', '>=65', 50);
      component.form.updateValueAndValidity();
      expect(component.form.errors?.['minimizationProbabilitiesInvalid']).toBeFalsy();

      component.strata.at(0).get('levelsStr')?.setValue('<65');

      expect(component.form.errors?.['minimizationProbabilitiesInvalid']).toBe(true);
      expect(component.form.valid).toBe(false);
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

    it('should expose proportional helper state for valid and invalid matrix inputs', () => {
      component.form.get('capsGroup.capStrategy')?.setValue('PROPORTIONAL');
      component.form.get('capsGroup.globalCap')?.enable();
      component.form.get('capsGroup.globalCap')?.setValue(100);

      expect(component.getPercentage('missing', 'level')).toBe(0);

      component.setPercentage('age', '<65', 60);
      component.setPercentage('age', '>=65', 40);

      expect(component.getPercentage('age', '<65')).toBe(60);
      expect(component.getFactorPercentageTotal('age', ['<65', '>=65'])).toBe(100);
      expect(component.isFactorPercentageInvalid('age')).toBe(false);
      expect(component.canComputeMatrix).toBe(true);

      component.form.get('capsGroup.globalCap')?.setValue(0);
      expect(component.canComputeMatrix).toBe(false);
    });

    it('should preserve and clear marginal cap helper values', () => {
      expect(component.getMarginalCap('age', '<65')).toBeUndefined();

      component.setMarginalCap('age', '<65', 12);
      expect(component.getMarginalCap('age', '<65')).toBe(12);

      component.setMarginalCap('age', '<65', undefined);
      expect(component.getMarginalCap('age', '<65')).toBeUndefined();
      expect(component.parseMarginalCapInput('')).toBeUndefined();
      expect(component.parseMarginalCapInput('7')).toBe(7);
      expect(component.parseMarginalCapInput('1.5')).toBeUndefined();
      expect(component.parseMarginalCapInput('-1')).toBeUndefined();
    });
  });

  describe('block override target options', () => {
    it('should render readable stratum labels while keeping code values', () => {
      component.strata.at(0).get('levelsStr')?.setValue('<65, >=65');
      component.addStratum();
      component.strata.at(1).get('name')?.setValue('Condition');
      component.strata.at(1).get('levelsStr')?.setValue('Diabetic, Diastolic');
      component.addBlockOverride();
      component.blockOverrides.at(0).get('targetType')?.setValue('stratum');

      const options = component.getBlockOverrideTargetOptionItems(0);

      expect(options.map(o => o.value)).toEqual(['<65-DIA', '<65-DIA', '>=6-DIA', '>=6-DIA']);
      expect(options.map(o => o.label)).toEqual([
        '<65 | Diabetic',
        '<65 | Diastolic',
        '>=65 | Diabetic',
        '>=65 | Diastolic',
      ]);
    });

    it('should expose target option codes for both site and stratum overrides', () => {
      component.addBlockOverride();
      component.blockOverrides.at(0).get('targetType')?.setValue('site');

      expect(component.getBlockOverrideTargetOptions(0)).toEqual(['101', '102', '103']);

      component.addStratum();
      component.strata.at(1).patchValue({
        id: 'gender',
        name: 'Gender',
        levelsStr: 'M, F'
      });
      component.blockOverrides.at(0).get('targetType')?.setValue('stratum');

      expect(component.getBlockOverrideTargetOptions(0)).toEqual(['<65-M', '<65-F', '>=6-M', '>=6-F']);
      expect(component.computedStratumCodes()).toEqual(['<65-M', '<65-F', '>=6-M', '>=6-F']);

      component.removeBlockOverride(0);
      expect(component.blockOverrides.length).toBe(0);
    });
  });

  describe('custom radio keyboard behavior', () => {
    it('should move to the next option on ArrowRight', () => {
      const control = component.form.get('designGroup.randomizationMethod');
      control?.setValue('BLOCK');
      const button = document.createElement('button');
      const group = document.createElement('div');
      group.setAttribute('role', 'radiogroup');
      const radioOne = document.createElement('button');
      radioOne.setAttribute('role', 'radio');
      const radioTwo = document.createElement('button');
      radioTwo.setAttribute('role', 'radio');
      group.append(radioOne, radioTwo);
      group.append(button);
      button.focus();
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      Object.defineProperty(event, 'currentTarget', { value: radioOne });

      component.onRadioGroupArrowKey(event, control, ['BLOCK', 'MINIMIZATION']);

      expect(control?.value).toBe('MINIMIZATION');
    });

    it('should wrap to the last option on ArrowLeft', () => {
      const control = component.form.get('capsGroup.capStrategy');
      control?.setValue('MANUAL_MATRIX');
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

      component.onRadioGroupArrowKey(event, control, ['MANUAL_MATRIX', 'PROPORTIONAL', 'MARGINAL_ONLY']);

      expect(control?.value).toBe('MARGINAL_ONLY');
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

  describe('error handling helpers', () => {
    it('should clamp attrition rates into the supported range', () => {
      expect(component.clampAttritionRate(Number.NaN)).toBe(0);
      expect(component.clampAttritionRate(-5)).toBe(0);
      expect(component.clampAttritionRate(17)).toBe(17);
      expect(component.clampAttritionRate(60)).toBe(50);
    });

    it('should show an error toast when code generation fails', () => {
      const toastSpy = vi.spyOn((component as any).toastService, 'showError');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (mockFacade as any).openCodeGenerator.mockImplementation(() => { throw new Error('boom'); });

      component.onGenerateCode('R');

      expect(toastSpy).toHaveBeenCalledWith('Error generating code. Please check your configuration.');
      consoleSpy.mockRestore();
    });

    it('should show an error toast when Monte Carlo startup fails', () => {
      const toastSpy = vi.spyOn((component as any).toastService, 'showError');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (mockFacade as any).runMonteCarlo.mockImplementation(() => { throw new Error('boom'); });

      component.onRunMonteCarlo();

      expect(toastSpy).toHaveBeenCalledWith('Error starting simulation. Please check your configuration.');
      consoleSpy.mockRestore();
    });

    it('should show an error toast when schema generation fails and fall back to empty review JSON', () => {
      const toastSpy = vi.spyOn((component as any).toastService, 'showError');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (mockFacade as any).generateSchema.mockImplementation(() => { throw new Error('boom'); });

      component.onSubmit();

      expect(toastSpy).toHaveBeenCalledWith('Error generating schema. Please check your configuration.');

      const buildSpy = vi.spyOn(component.store, 'buildConfig').mockImplementation(() => { throw new Error('bad json'); });
      expect(component.reviewConfigJson).toBe('{}');
      buildSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('Algorithm-switch scenarios', () => {
    it('should cleanly transition from BLOCK to MINIMIZATION (payload cleanliness and UI state)', () => {
      // 1. Setup as BLOCK initially with some block specific values
      component.form.get('designGroup.randomizationMethod')?.setValue('BLOCK');
      component.form.get('allocationGroup.blockSizesStr')?.setValue('4, 8');
      component.form.get('allocationGroup.blockSelectionType')?.setValue('FIXED_SEQUENCE');
      component.addBlockOverride();
      component.blockOverrides.at(0).patchValue({
        targetType: 'site',
        targetId: '101',
        sizesStr: '2, 4',
        selectionType: 'RANDOM_POOL'
      });
      component.form.updateValueAndValidity();

      // Ensure block controls are enabled initially
      expect(component.form.get('allocationGroup.blockSizesStr')?.enabled).toBe(true);
      expect(component.form.get('allocationGroup.blockSelectionType')?.enabled).toBe(true);

      // 2. Switch to MINIMIZATION
      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
      component.setMinimizationProbability('age', '<65', 50);
      component.setMinimizationProbability('age', '>=65', 50);

      // The bug #279 (#338 PR) fixes this payload so that the UI states updates without manual triggering
      // We still updateValueAndValidity for testing flow if necessary, but the component has
      // internal reactive subscriptions that disable the fields.
      fixture.detectChanges();

      // UI state: Block fields disabled, Min fields enabled
      expect(component.form.get('allocationGroup.blockSizesStr')?.disabled).toBe(true);
      expect(component.form.get('allocationGroup.blockSelectionType')?.disabled).toBe(true);
      expect(component.form.get('allocationGroup.minimizationP')?.enabled).toBe(true);
      expect(component.form.get('allocationGroup.totalSampleSize')?.enabled).toBe(true);

      // Payload cleanliness: The generated config should not have block specific values
      component.onSubmit();
      const arg = (mockFacade as any).generateSchema.mock.calls.at(-1)?.[0];
      expect(arg.randomizationMethod).toBe('MINIMIZATION');
      expect(arg.globalBlockStrategy).toBeUndefined();
      expect(arg.siteBlockOverrides).toBeUndefined();
      expect(arg.stratumBlockOverrides).toBeUndefined();

      // Depending on the store logic it might be [] instead of undefined since MINIMIZATION passes [] for block sizes
      if (arg.blockSizes !== undefined) {
        expect(arg.blockSizes).toEqual([]);
      }
    });

    it('should cleanly transition from MINIMIZATION to BLOCK (payload cleanliness and UI state)', () => {
      // Setup as MINIMIZATION
      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
      component.form.get('allocationGroup.minimizationP')?.setValue(0.9);
      component.form.get('allocationGroup.totalSampleSize')?.setValue(200);
      component.setMinimizationProbability('age', '<65', 50);
      component.setMinimizationProbability('age', '>=65', 50);
      component.form.updateValueAndValidity();

      expect(component.form.get('allocationGroup.minimizationP')?.enabled).toBe(true);

      // Switch to BLOCK
      component.form.get('designGroup.randomizationMethod')?.setValue('BLOCK');
      component.form.get('allocationGroup.blockSizesStr')?.setValue('4');
      component.form.get('allocationGroup.blockSelectionType')?.setValue('RANDOM_POOL');
      fixture.detectChanges();

      // UI State: Min fields disabled, block fields enabled
      expect(component.form.get('allocationGroup.minimizationP')?.disabled).toBe(true);
      expect(component.form.get('allocationGroup.totalSampleSize')?.disabled).toBe(true);
      expect(component.form.get('allocationGroup.blockSizesStr')?.enabled).toBe(true);

      // Payload cleanliness: Should not contain minimization config
      component.onSubmit();
      const arg = (mockFacade as any).generateSchema.mock.calls.at(-1)?.[0];
      expect(arg.randomizationMethod).toBe('BLOCK');
      expect(arg.minimizationConfig).toBeUndefined();
      expect(arg.globalBlockStrategy).toBeDefined();
    });

    it('should maintain form validity through multiple algorithm switches without race conditions (revalidation)', () => {
      // Setup invalid block size initially
      component.form.get('designGroup.randomizationMethod')?.setValue('BLOCK');
      component.form.get('allocationGroup.blockSizesStr')?.setValue('3'); // Invalid block size since arms sum to 2
      component.form.updateValueAndValidity();

      expect(component.form.errors?.['invalidBlockSize']).toBe(true);
      expect(component.form.valid).toBe(false);

      // Switch to MINIMIZATION, probability valid
      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
      component.setMinimizationProbability('age', '<65', 50);
      component.setMinimizationProbability('age', '>=65', 50);

      // Because of the bugfix (#282), `this.form.updateValueAndValidity({ emitEvent: false })`
      // in syncLevelDetails and subscriptions should ensure the form correctly revalidates
      // when switching, clearing the block size error.
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();

      // Need to make sure the form as a whole is valid if other things are correct.
      // metadata has some required fields like protocolId, so let's set it.
      component.form.get('metadataGroup.protocolId')?.setValue('TEST-001');
      expect(component.form.valid).toBe(true);

      // Switch back to BLOCK, the error should return since blockSizesStr is still '3'
      // But wait, when disabled, does it retain value and cause error? The validator checks if method === 'MINIMIZATION' to bypass.
      component.form.get('designGroup.randomizationMethod')?.setValue('BLOCK');
      expect(component.form.errors?.['invalidBlockSize']).toBe(true);
      expect(component.form.valid).toBe(false);

      // Correct it
      component.form.get('allocationGroup.blockSizesStr')?.setValue('4');
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
      expect(component.form.valid).toBe(true);
    });
  });

  describe('Allocation mechanics validation UI', () => {
    const goToAllocationStep = (): void => {
      for (let i = 0; i < 3; i += 1) {
        const nextButton = fixture.nativeElement.querySelector('button[cdkStepperNext]') as HTMLButtonElement;
        nextButton.click();
        fixture.detectChanges();
      }
    };

    it('should show minimization probability validation text when touched and out of range', () => {
      goToAllocationStep();
      component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
      fixture.detectChanges();

      const minimizationP = component.form.get('allocationGroup.minimizationP');
      minimizationP?.setValue(0.4);
      minimizationP?.markAsTouched();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Probability must be between 0.5 and 1.0.');
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
