import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
  selector: '[appKeyboardScroll]',
  standalone: true
})
export class KeyboardScrollDirective {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    const el = this.el.nativeElement;
    const scrollAmount = 40; // Pixels to scroll

    switch (event.key) {
      case 'ArrowUp':
        el.scrollTop -= scrollAmount;
        event.preventDefault();
        break;
      case 'ArrowDown':
        el.scrollTop += scrollAmount;
        event.preventDefault();
        break;
      case 'ArrowLeft':
        el.scrollLeft -= scrollAmount;
        event.preventDefault();
        break;
      case 'ArrowRight':
        el.scrollLeft += scrollAmount;
        event.preventDefault();
        break;
    }
  }
}
