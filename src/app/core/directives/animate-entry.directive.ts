import { Directive, ElementRef, Input, OnInit } from '@angular/core';
import { animate } from 'motion/mini';

/**
 * AnimateEntryDirective
 *
 * Applies a spring-physics slide-down + fade-in animation to the host element
 * when it is first mounted into the DOM.  Pass an integer index via the
 * directive binding to stagger sibling elements by 50 ms each.
 *
 * Usage:
 *   <div [appAnimateEntry]="$index"> ... </div>
 */
@Directive({
  selector: '[appAnimateEntry]',
  standalone: true,
})
export class AnimateEntryDirective implements OnInit {
  /** Stagger index – each unit adds 50 ms of entry delay. */
  @Input('appAnimateEntry') index: number = 0;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const delay = (this.index ?? 0) * 0.05;
    animate(
      this.el.nativeElement,
      { opacity: [0, 1], y: [-10, 0] },
      {
        duration: 0.4,
        delay,
        type: 'spring',
        stiffness: 300,
        damping: 25,
      } as Parameters<typeof animate>[2]
    );
  }
}
