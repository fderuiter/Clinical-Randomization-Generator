import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfigFormComponent } from './config-form.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { StudyBuilderStore } from '../store/study-builder.store';
import { ConfigStorageService } from '../../../core/services/config-storage.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('ConfigFormComponent (domain)', () => {
  let component: ConfigFormComponent;
  let fixture: ComponentFixture<ConfigFormComponent>;
  let mockFacade: any;
  let mockStorage: any;

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

    mockStorage = {
      saveDraft: vi.fn(),
      loadDraft: vi.fn().mockReturnValue(null),
      clearDraft: vi.fn(),
      hasDraft: vi.fn().mockReturnValue(false)
    };

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, ConfigFormComponent],
      providers: [
        { provide: RandomizationEngineFacade, useValue: mockFacade },
        { provide: ConfigStorageService, useValue: mockStorage },
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
    component.form.get('protocolId')?.setValue('NEW-ID');
    expect(mockFacade.clearResults).toHaveBeenCalled();
  });

  it('should load the standard preset correctly', () => {
    component.loadPreset('standard');

    expect(component.form.get('protocolId')?.value).toBe('STD-002');
    expect(component.arms.length).toBe(2);
    expect(component.strata.length).toBe(1);
    expect(component.stratumCaps.length).toBe(2); // 2 age levels
  });

  describe('onSubmit()', () => {
    it('should call facade.generateSchema when the form is valid', () => {
      component.onSubmit();
      expect(mockFacade.generateSchema).toHaveBeenCalledTimes(1);
      const arg = mockFacade.generateSchema.mock.calls[0][0];
      expect(arg.protocolId).toBe(component.form.get('protocolId')?.value);
    });

    it('should NOT call facade.generateSchema when the form is invalid', () => {
      component.form.get('protocolId')?.setValue('');
      component.onSubmit();
      expect(mockFacade.generateSchema).not.toHaveBeenCalled();
    });
  });

  describe('onGenerateCode()', () => {
    it('should call facade.openCodeGenerator with the correct language when the form is valid', () => {
      component.onGenerateCode('R');
      expect(mockFacade.openCodeGenerator).toHaveBeenCalledTimes(1);
      const [, lang] = mockFacade.openCodeGenerator.mock.calls[0];
      expect(lang).toBe('R');
    });

    it('should pass SAS as the language when requested', () => {
      component.onGenerateCode('SAS');
      const [, lang] = mockFacade.openCodeGenerator.mock.calls[0];
      expect(lang).toBe('SAS');
    });

    it('should pass Python as the language when requested', () => {
      component.onGenerateCode('Python');
      const [, lang] = mockFacade.openCodeGenerator.mock.calls[0];
      expect(lang).toBe('Python');
    });

    it('should NOT call facade.openCodeGenerator when the form is invalid', () => {
      component.form.get('protocolId')?.setValue('');
      component.onGenerateCode('Python');
      expect(mockFacade.openCodeGenerator).not.toHaveBeenCalled();
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

    it('should not change strata when onStrataDrop() has equal indices', () => {
      component.loadPreset('standard');
      const snapshot = component.strata.value;
      component.onStrataDrop({ previousIndex: 0, currentIndex: 0 } as any);
      expect(component.strata.value).toEqual(snapshot);
    });
  });

  describe('validateBlockSizes()', () => {
    it('should have no form errors when all block sizes are multiples of the total ratio', () => {
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
    });

    it('should set invalidBlockSize error when a block size is not a multiple of total ratio', () => {
      component.form.get('blockSizesStr')?.setValue('3');
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

    it('should re-run the validator after loadPreset() changes the total arm ratio', () => {
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
      component.loadPreset('complex');
      expect(component.form.errors?.['invalidBlockSize']).toBeFalsy();
      expect(component.form.valid).toBe(true);
    });

    it('should detect an invalid block size immediately after preset loading changes the ratio', () => {
      component.loadPreset('complex');
      component.form.get('blockSizesStr')?.setValue('4');
      component.form.updateValueAndValidity();
      expect(component.form.errors?.['invalidBlockSize']).toBe(true);
      expect(component.form.valid).toBe(false);
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

  // ── Draft Restore/Discard ──────────────────────────────────────────────────

  describe('Draft restore/discard banner', () => {
    it('should NOT show the draft banner when no draft is stored', () => {
      expect(component.draftBannerVisible()).toBe(false);
    });

    it('should show the draft banner on init when a draft exists', async () => {
      const draft = {
        schemaVersion: 'v1.5.1',
        savedAt: new Date().toISOString(),
        config: {
          protocolId: 'SAVED-001', studyName: 'Saved Study', phase: 'II',
          arms: [{ id: 'A', name: 'Active', ratio: 1 }, { id: 'B', name: 'Placebo', ratio: 1 }],
          strata: [], sitesStr: '101', blockSizesStr: '4', stratumCaps: [], seed: '', subjectIdMask: '[SiteID]-[001]'
        }
      };
      mockStorage.loadDraft.mockReturnValue(draft);

      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ReactiveFormsModule, ConfigFormComponent],
        providers: [
          { provide: RandomizationEngineFacade, useValue: mockFacade },
          { provide: ConfigStorageService, useValue: mockStorage },
          StudyBuilderStore
        ]
      }).compileComponents();

      const f = TestBed.createComponent(ConfigFormComponent);
      f.detectChanges();
      expect(f.componentInstance.draftBannerVisible()).toBe(true);
    });

    it('should call clearDraft() and hide banner when discardDraft() is called', () => {
      component.draftBannerVisible.set(true);
      component.discardDraft();
      expect(mockStorage.clearDraft).toHaveBeenCalled();
      expect(component.draftBannerVisible()).toBe(false);
    });

    it('should restore form values and hide banner when restoreDraft() is called', () => {
      const draft = {
        schemaVersion: 'v1.5.1',
        savedAt: new Date().toISOString(),
        config: {
          protocolId: 'RESTORED-001', studyName: 'Restored Study', phase: 'III',
          arms: [{ id: 'A', name: 'RestoreArm', ratio: 2 }, { id: 'B', name: 'Placebo', ratio: 1 }],
          strata: [{ id: 'age', name: 'Age', levelsStr: '<65, >=65' }],
          sitesStr: '101, 102', blockSizesStr: '4, 6', stratumCaps: [], seed: 'myseed', subjectIdMask: '[SiteID]-[001]'
        }
      };
      mockStorage.loadDraft.mockReturnValue(draft);
      component.draftBannerVisible.set(true);
      component.restoreDraft();

      expect(component.form.get('protocolId')?.value).toBe('RESTORED-001');
      expect(component.form.get('studyName')?.value).toBe('Restored Study');
      expect(component.arms.length).toBe(2);
      expect((component.arms.at(0).value as { name: string }).name).toBe('RestoreArm');
      expect(component.strata.length).toBe(1);
      expect(component.draftBannerVisible()).toBe(false);
    });

    it('should do nothing when restoreDraft() is called but no draft exists', () => {
      mockStorage.loadDraft.mockReturnValue(null);
      const protocolIdBefore = component.form.get('protocolId')?.value;
      component.restoreDraft();
      expect(component.form.get('protocolId')?.value).toBe(protocolIdBefore);
    });
  });

  // ── JSON Import / Export ───────────────────────────────────────────────────

  describe('onImportFileSelected()', () => {
    it('should populate the form with a valid config JSON file', () => {
      const configData = {
        schemaVersion: 'v1.5.1',
        exportedAt: new Date().toISOString(),
        config: {
          protocolId: 'IMP-001', studyName: 'Imported Study', phase: 'I',
          arms: [{ id: 'A', name: 'ImportArm', ratio: 1 }, { id: 'B', name: 'Control', ratio: 1 }],
          strata: [], sitesStr: 'Site A', blockSizesStr: '2', stratumCaps: [], seed: '', subjectIdMask: '[SiteID]-[001]'
        }
      };
      const jsonStr = JSON.stringify(configData);
      const file = new File([jsonStr], 'config_IMP-001.json', { type: 'application/json' });
      const event = { target: { files: [file], value: '' } } as unknown as Event;

      return new Promise<void>((resolve) => {
        // Patch FileReader to synchronously call onload
        const originalFileReader = window.FileReader;
        (window as any).FileReader = class {
          onload: ((e: any) => void) | null = null;
          readAsText(_file: File) {
            if (this.onload) {
              this.onload({ target: { result: jsonStr } });
            }
          }
        };
        component.onImportFileSelected(event);
        (window as any).FileReader = originalFileReader;
        expect(component.form.get('protocolId')?.value).toBe('IMP-001');
        expect(component.form.get('studyName')?.value).toBe('Imported Study');
        resolve();
      });
    });

    it('should call alert() when the uploaded JSON has invalid structure', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const badJson = JSON.stringify({ some: 'garbage', noArms: true });
      const file = new File([badJson], 'bad.json', { type: 'application/json' });
      const event = { target: { files: [file], value: '' } } as unknown as Event;

      const originalFileReader = window.FileReader;
      (window as any).FileReader = class {
        onload: ((e: any) => void) | null = null;
        readAsText(_file: File) {
          if (this.onload) this.onload({ target: { result: badJson } });
        }
      };
      component.onImportFileSelected(event);
      (window as any).FileReader = originalFileReader;
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid configuration file'));
      alertSpy.mockRestore();
    });

    it('should call alert() when the uploaded file is not valid JSON', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const file = new File(['not-json!!!'], 'bad.txt', { type: 'text/plain' });
      const event = { target: { files: [file], value: '' } } as unknown as Event;

      const originalFileReader = window.FileReader;
      (window as any).FileReader = class {
        onload: ((e: any) => void) | null = null;
        readAsText(_file: File) {
          if (this.onload) this.onload({ target: { result: 'not-json!!!' } });
        }
      };
      component.onImportFileSelected(event);
      (window as any).FileReader = originalFileReader;
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to parse'));
      alertSpy.mockRestore();
    });

    it('should do nothing when no file is selected', () => {
      const protocolIdBefore = component.form.get('protocolId')?.value;
      const event = { target: { files: null, value: '' } } as unknown as Event;
      component.onImportFileSelected(event);
      expect(component.form.get('protocolId')?.value).toBe(protocolIdBefore);
    });
  });
});
