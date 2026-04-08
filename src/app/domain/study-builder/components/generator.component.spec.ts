import { TestBed } from '@angular/core/testing';
import { GeneratorComponent } from './generator.component';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';

describe('GeneratorComponent (domain)', () => {
  let mockFacade: any;

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
      imports: [GeneratorComponent],
      providers: [
        { provide: RandomizationEngineFacade, useValue: mockFacade },
        provideRouter([])
      ]
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(GeneratorComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show loading spinner when isGenerating is true', () => {
    mockFacade.isGenerating.set(true);
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.animate-spin')).toBeTruthy();
  });

  it('should show error message when error signal has a value', () => {
    mockFacade.error.set('Block size error');
    const fixture = TestBed.createComponent(GeneratorComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Block size error');
  });
});
