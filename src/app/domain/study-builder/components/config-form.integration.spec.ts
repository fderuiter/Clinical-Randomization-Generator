/* eslint-disable @typescript-eslint/no-explicit-any */
import { signal } from '@angular/core';
import { fireEvent, render, waitFor } from '@testing-library/angular';
import { vi } from 'vitest';
import { ConfigFormComponent } from './config-form.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { StudyBuilderStore } from '../store/study-builder.store';

const createFacadeMock = () => {
  const config = signal<any>(null);
  const results = signal<any>(null);
  const isGenerating = signal(false);
  const error = signal<string | null>(null);
  const showCodeGenerator = signal(false);
  const codeLanguage = signal<'R' | 'SAS' | 'Python' | 'STATA'>('R');

  return {
    config,
    results,
    isGenerating,
    error,
    showCodeGenerator,
    codeLanguage,
    generateSchema: vi.fn((nextConfig: unknown) => {
      config.set(nextConfig);
      isGenerating.set(true);
    }),
    openCodeGenerator: vi.fn(),
    closeCodeGenerator: vi.fn(),
    clearResults: vi.fn()
  };
};

describe('ConfigFormComponent integration', () => {
  const renderComponent = async () => {
    const facade = createFacadeMock();
    const rendered = await render(ConfigFormComponent, {
      providers: [
        { provide: RandomizationEngineFacade, useValue: facade },
        StudyBuilderStore
      ]
    });

    return {
      ...rendered,
      component: rendered.fixture.componentInstance,
      facade
    };
  };

  it('invalidates immediately when a new minimization factor introduces unset probability totals', async () => {
    const { component, fixture } = await renderComponent();

    component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
    component.setMinimizationProbability('age', '<65', 50);
    component.setMinimizationProbability('age', '>=65', 50);
    component.form.updateValueAndValidity();
    fixture.detectChanges();

    expect(component.form.valid).toBe(true);

    component.addStratum();
    component.strata.at(1).patchValue({
      id: 'severity',
      name: 'Severity',
      levelsStr: 'Mild, Moderate, Severe'
    });
    fixture.detectChanges();

    await waitFor(() => {
      expect(component.form.errors?.['minimizationProbabilitiesInvalid']).toBe(true);
      expect(component.form.valid).toBe(false);
      expect(component.isStrataStepNextDisabled).toBe(true);
    });
  });

  it('strips inactive allocation fields from the raw payload across algorithm toggles', async () => {
    const { component, fixture } = await renderComponent();

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

    component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
    fixture.detectChanges();

    const minimizationPayload = (component as any).buildFormValue();
    expect(minimizationPayload).toMatchObject({
      randomizationMethod: 'MINIMIZATION',
      minimizationP: component.form.get('allocationGroup.minimizationP')?.value,
      totalSampleSize: component.form.get('allocationGroup.totalSampleSize')?.value
    });
    expect(minimizationPayload).not.toHaveProperty('blockSizesStr');
    expect(minimizationPayload).not.toHaveProperty('blockSelectionType');
    expect(minimizationPayload).not.toHaveProperty('blockOverrides');

    component.form.get('allocationGroup.minimizationP')?.setValue(0.9);
    component.form.get('allocationGroup.totalSampleSize')?.setValue(240);
    component.form.get('designGroup.randomizationMethod')?.setValue('BLOCK');
    fixture.detectChanges();

    const blockPayload = (component as any).buildFormValue();
    expect(blockPayload).toMatchObject({
      randomizationMethod: 'BLOCK',
      blockSizesStr: '4, 8',
      blockSelectionType: 'FIXED_SEQUENCE'
    });
    expect(blockPayload).not.toHaveProperty('minimizationP');
    expect(blockPayload).not.toHaveProperty('totalSampleSize');
  });

  it('submits the sanitized payload through the facade and enters loading state', async () => {
    const { component, fixture, facade } = await renderComponent();

    component.form.get('allocationGroup.blockSizesStr')?.setValue('4, 8');
    component.form.get('allocationGroup.blockSelectionType')?.setValue('FIXED_SEQUENCE');
    component.form.get('designGroup.randomizationMethod')?.setValue('MINIMIZATION');
    component.setMinimizationProbability('age', '<65', 50);
    component.setMinimizationProbability('age', '>=65', 50);
    fixture.detectChanges();

    const expectedPayload = component.store.buildConfig((component as any).buildFormValue());

    await fireEvent.submit(fixture.nativeElement.querySelector('form'));

    expect(facade.generateSchema).toHaveBeenCalledOnce();
    expect(facade.generateSchema).toHaveBeenCalledWith(expectedPayload);
    expect(facade.isGenerating()).toBe(true);

    const submittedPayload = facade.generateSchema.mock.calls[0][0];
    expect(submittedPayload.globalBlockStrategy).toBeUndefined();
    expect(submittedPayload.siteBlockOverrides).toBeUndefined();
    expect(submittedPayload.stratumBlockOverrides).toBeUndefined();
    expect(submittedPayload.blockSizes).toEqual([]);
  });
});
