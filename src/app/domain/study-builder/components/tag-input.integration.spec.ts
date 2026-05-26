import { FormControl } from '@angular/forms';
import { fireEvent, render, screen } from '@testing-library/angular';
import { TagInputComponent } from './tag-input.component';

describe('TagInputComponent integration', () => {
  it('splits pasted comma-delimited values into distinct tags', async () => {
    const control = new FormControl('');
    const { fixture } = await render(TagInputComponent, {
      componentInputs: {
        control,
        placeholder: 'Study sites'
      }
    });

    const input = screen.getByRole('textbox', { name: 'Study sites' });
    const pastedValue = 'Site A, Site B, Site C';
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { getData: () => pastedValue }
    });

    await fireEvent(input, pasteEvent);
    await fireEvent.input(input, { target: { value: pastedValue } });
    await fireEvent.blur(input);

    expect(fixture.componentInstance.tags).toHaveLength(3);
    expect(fixture.componentInstance.tags).toEqual(['Site A', 'Site B', 'Site C']);
    expect(fixture.componentInstance.tags).not.toContain(pastedValue);
    expect(control.value).toBe(pastedValue);
  });
});
