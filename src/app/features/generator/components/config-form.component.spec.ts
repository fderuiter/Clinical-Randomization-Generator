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
      closeCodeGenerator: vi.fn()
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
});
