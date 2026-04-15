import { animate } from 'motion';

/**
 * Thin wrapper around Motion's `animate()` that:
 *  - Is a no-op (resolves immediately) in SSR/non-browser environments.
 *  - Respects the `prefers-reduced-motion` media query by skipping the animation.
 *  - Returns a Promise<void> that resolves when the animation completes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function animateIfMotionOK(element: Element, keyframes: any, options?: any): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  try {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      return Promise.resolve();
    }
    const controls = animate(element as HTMLElement, keyframes, options) as {
      finished: Promise<void>;
    };
    return controls.finished;
  } catch {
    return Promise.resolve();
  }
}
