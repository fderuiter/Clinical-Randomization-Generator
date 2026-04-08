import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfigFormComponent } from './config-form.component';
import { GeneratorStateService } from '../../../core/services/generator-state.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('ConfigFormComponent', () => {
  let component: ConfigFormComponent;
  let fixture: ComponentFixture<ConfigFormComponent>;
  let mockStateService: any;

  beforeEach(async () => {
    mockStateService = {
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
        { provide: GeneratorStateService, useValue: mockStateService }
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
    // Add a second strata
    component.addStratum();
    const strataArray = component.strata;

    // Set first strata: Age Group
    strataArray.at(0).get('id')?.setValue('age');
    strataArray.at(0).get('levelsStr')?.setValue('<65, >=65');

    // Set second strata: Gender
    strataArray.at(1).get('id')?.setValue('gender');
    strataArray.at(1).get('levelsStr')?.setValue('M, F');

    // Trigger value changes manually if it didn't trigger
    component.updateStratumCaps();

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

    expect(component.form.get('protocolId')?.value).toBe('SIMP-001');
    expect(component.arms.length).toBe(2);
    expect(component.strata.length).toBe(0);
    expect(component.stratumCaps.length).toBe(1); // Default cap (no strata)
  });

  it('should load complex preset', () => {
    component.loadPreset('complex');

    expect(component.form.get('protocolId')?.value).toBe('CMPX-003');
    expect(component.arms.length).toBe(3);
    expect(component.strata.length).toBe(3);
    expect(component.stratumCaps.length).toBe(8); // 2 * 2 * 2 = 8 combinations
  });

  it('should set correct arm names and ratios after loading the complex preset', () => {
    component.loadPreset('complex');

    const armsValue = component.arms.value as {id: string; name: string; ratio: number}[];
    expect(armsValue[0].name).toBe('High Dose');
    expect(armsValue[1].name).toBe('Low Dose');
    expect(armsValue[2].name).toBe('Placebo');
    armsValue.forEach(a => expect(a.ratio).toBe(1));
  });

  it('should overwrite all previous arm names when switching presets', () => {
    // Start with the default state (Active, Placebo)
    expect(component.arms.length).toBe(2);
    expect((component.arms.at(0).value as {name: string}).name).toBe('Active');

    // Load complex preset – must fully replace, not partially patch
    component.loadPreset('complex');

    expect(component.arms.length).toBe(3);
    expect((component.arms.at(0).value as {name: string}).name).toBe('High Dose');
    expect((component.arms.at(1).value as {name: string}).name).toBe('Low Dose');
    expect((component.arms.at(2).value as {name: string}).name).toBe('Placebo');
  });

  it('should call clearResults() when a form field value changes', () => {
    // Simulate an existing schema result
    component.form.get('protocolId')?.setValue('NEW-ID');
    expect(mockStateService.clearResults).toHaveBeenCalled();
  });

  it('should load the standard preset correctly', () => {
    component.loadPreset('standard');

    expect(component.form.get('protocolId')?.value).toBe('STD-002');
    expect(component.arms.length).toBe(2);
    expect(component.strata.length).toBe(1);
    // 1 stratum with 2 levels (<65, >=65) → 2 combinations
    expect(component.stratumCaps.length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Form submission
  // ---------------------------------------------------------------------------
  describe('onSubmit()', () => {
    it('should call state.generateSchema when the form is valid', () => {
      component.onSubmit();
      expect(mockStateService.generateSchema).toHaveBeenCalledTimes(1);
      const arg = mockStateService.generateSchema.mock.calls[0][0];
      expect(arg.protocolId).toBe(component.form.get('protocolId')?.value);
    });

    it('should NOT call state.generateSchema when the form is invalid', () => {
      component.form.get('protocolId')?.setValue('');
      component.onSubmit();
      expect(mockStateService.generateSchema).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Code generation
  // ---------------------------------------------------------------------------
  describe('onGenerateCode()', () => {
    it('should call state.openCodeGenerator with the correct language when the form is valid', () => {
      component.onGenerateCode('R');
      expect(mockStateService.openCodeGenerator).toHaveBeenCalledTimes(1);
      const [, lang] = mockStateService.openCodeGenerator.mock.calls[0];
      expect(lang).toBe('R');
    });

    it('should pass SAS as the language when requested', () => {
      component.onGenerateCode('SAS');
      const [, lang] = mockStateService.openCodeGenerator.mock.calls[0];
      expect(lang).toBe('SAS');
    });

    it('should pass Python as the language when requested', () => {
      component.onGenerateCode('Python');
      const [, lang] = mockStateService.openCodeGenerator.mock.calls[0];
      expect(lang).toBe('Python');
    });

    it('should NOT call state.openCodeGenerator when the form is invalid', () => {
      component.form.get('protocolId')?.setValue('');
      component.onGenerateCode('Python');
      expect(mockStateService.openCodeGenerator).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Arm management
  // ---------------------------------------------------------------------------
  describe('arm management', () => {
    it('should add a new arm when addArm() is called', () => {
      const before = component.arms.length;
      component.addArm();
      expect(component.arms.length).toBe(before + 1);
    });

    it('should remove an arm when removeArm() is called and there are more than 2 arms', () => {
      component.addArm(); // now 3 arms
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
      // Default 2 arms with ratio 1 each
      expect(component.totalRatio).toBe(2);
      component.arms.at(0).get('ratio')?.setValue(3);
      expect(component.totalRatio).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Strata management
  // ---------------------------------------------------------------------------
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
  });

  // ---------------------------------------------------------------------------
  // Block size validator
  // ---------------------------------------------------------------------------
  describe('validateBlockSizes()', () => {
    it('should have no form errors when all block sizes are multiples of the total ratio', () => {
      // Default: total ratio = 2, block sizes = "4, 6" — both multiples of 2
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
    });

    it('should set invalidBlockSize error when a block size is not a multiple of total ratio', () => {
      component.form.get('blockSizesStr')?.setValue('3'); // 3 is not a multiple of 2
      component.form.updateValueAndValidity();
      expect(component.form.errors?.['invalidBlockSize']).toBe(true);
    });

    it('should clear the error once a valid block size is restored', () => {
      component.form.get('blockSizesStr')?.setValue('3');
      component.form.updateValueAndValidity();
      expect(component.form.errors?.['invalidBlockSize']).toBe(true);

      component.form.get('blockSizesStr')?.setValue('4');
      component.form.updateValueAndValidity();
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
    });
  });

  // ---------------------------------------------------------------------------
  // parseCommaSeparated()
  // ---------------------------------------------------------------------------
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
