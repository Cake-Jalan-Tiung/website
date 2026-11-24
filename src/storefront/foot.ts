// What is pinned to the foot of the screen (the bag bar, the last-order card, checkout's Pay)
// says how tall it is, so the page keeps focus and its last lines clear of it: each writes its
// height into a custom property on <html>, which index.css adds to scroll-padding-bottom and
// which the page reserves below its content. Measured, not a constant, because each grows with
// larger text, an error above Pay or a longer order.

export type Foot = 'foot-bar' | 'foot-card' | 'foot-pay';

/**
 * A ref callback that reports the element's height while it is attached. Create one per kind at
 * module scope, so React keeps the same callback between renders.
 */
export function footRef(name: Foot) {
  return (element: HTMLElement | null) => {
    if (!element) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty(`--${name}`, `${element.offsetHeight}px`));
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(`--${name}`);
    };
  };
}
