import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { vi } from 'vitest';
import { TagInputComponent } from './tag-input.component';

describe('TagInputComponent', () => {
  let component: TagInputComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagInputComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(TagInputComponent);
    component = fixture.componentInstance;
    component.control = new FormControl('');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('parseValue()', () => {
    it('should parse a comma-separated string into a trimmed array', () => {
      expect(component.parseValue('101, 102, 103')).toEqual(['101', '102', '103']);
    });

    it('should return an empty array for null', () => {
      expect(component.parseValue(null)).toEqual([]);
    });

    it('should return an empty array for an empty string', () => {
      expect(component.parseValue('')).toEqual([]);
    });

    it('should filter out blank segments caused by consecutive commas', () => {
      expect(component.parseValue('a,,b')).toEqual(['a', 'b']);
    });
  });

  describe('toStr()', () => {
    it('should join tags with ", "', () => {
      component.tags = ['101', '102', '103'];
      expect(component.toStr()).toBe('101, 102, 103');
    });

    it('should return empty string when there are no tags', () => {
      component.tags = [];
      expect(component.toStr()).toBe('');
    });
  });

  describe('ngOnInit()', () => {
    it('should initialise tags from the control value', () => {
      const ctrl = new FormControl('a, b, c');
      const fixture = TestBed.createComponent(TagInputComponent);
      const comp = fixture.componentInstance;
      comp.control = ctrl;
      fixture.detectChanges();
      expect(comp.tags).toEqual(['a', 'b', 'c']);
    });

    it('should update tags when the control value changes externally', () => {
      component.control.setValue('x, y');
      expect(component.tags).toEqual(['x', 'y']);
    });
  });

  describe('commitInput()', () => {
    it('should add a new tag and update the control value', () => {
      component.inputValue = '101';
      component.commitInput();
      expect(component.tags).toContain('101');
      expect(component.control.value).toBe('101');
    });

    it('should clear inputValue after adding', () => {
      component.inputValue = '101';
      component.commitInput();
      expect(component.inputValue).toBe('');
    });

    it('should not add a duplicate tag', () => {
      component.tags = ['101'];
      component.inputValue = '101';
      component.commitInput();
      expect(component.tags.filter(t => t === '101').length).toBe(1);
    });

    it('should trim trailing commas from the input', () => {
      component.inputValue = '101,';
      component.commitInput();
      expect(component.tags).toContain('101');
    });

    it('should not add an empty tag', () => {
      component.inputValue = '   ';
      component.commitInput();
      expect(component.tags.length).toBe(0);
    });
  });

  describe('removeTag()', () => {
    it('should remove the specified tag and update the control', () => {
      component.tags = ['101', '102', '103'];
      component.removeTag('102');
      expect(component.tags).toEqual(['101', '103']);
      expect(component.control.value).toBe('101, 103');
    });
  });

  describe('onKeydown()', () => {
    it('should call commitInput on Enter', () => {
      component.inputValue = '999';
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const spy = vi.spyOn(component, 'commitInput');
      component.onKeydown(event);
      expect(spy).toHaveBeenCalled();
    });

    it('should call commitInput on comma key', () => {
      component.inputValue = '888';
      const event = new KeyboardEvent('keydown', { key: ',' });
      const spy = vi.spyOn(component, 'commitInput');
      component.onKeydown(event);
      expect(spy).toHaveBeenCalled();
    });

    it('should remove the last tag on Backspace when inputValue is empty', () => {
      component.tags = ['101', '102'];
      component.inputValue = '';
      const event = new KeyboardEvent('keydown', { key: 'Backspace' });
      component.onKeydown(event);
      expect(component.tags).toEqual(['101']);
    });

    it('should NOT remove a tag on Backspace when inputValue is non-empty', () => {
      component.tags = ['101', '102'];
      component.inputValue = 'abc';
      const event = new KeyboardEvent('keydown', { key: 'Backspace' });
      component.onKeydown(event);
      expect(component.tags.length).toBe(2);
    });
  });

  describe('onBlur()', () => {
    it('should commit the current inputValue on blur', () => {
      component.inputValue = '555';
      component.onBlur();
      expect(component.tags).toContain('555');
    });

    it('should not add anything on blur when inputValue is empty', () => {
      component.inputValue = '';
      component.onBlur();
      expect(component.tags.length).toBe(0);
    });
  });
});
