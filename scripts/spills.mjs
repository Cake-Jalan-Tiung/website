// Run in the page: everything that spills. An element past the viewport edge, content wider than
// its box, or content cut off by a box that clips. Shared by `pnpm fit` and the phone walk.
export function findSpills() {
  const viewport = document.documentElement.clientWidth;
  const name = (el) => `${el.tagName.toLowerCase()}${el.dataset?.cjt ? `[${el.dataset.cjt}]` : ''} "${(el.textContent ?? '').trim().slice(0, 24)}"`;
  const spills = new Set();
  if (document.documentElement.scrollWidth > viewport) spills.add(`the page scrolls sideways by ${document.documentElement.scrollWidth - viewport}px`);
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') && el.tagName !== 'svg') continue;
    // A marquee clips its passing content and a bar scrolls its links, both on purpose.
    if (el.closest('[data-fit]')) continue;
    const box = el.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue;
    if (box.right > viewport + 0.5 || box.left < -0.5) spills.add(`${name(el)} leaves the viewport (${Math.round(box.left)} to ${Math.round(box.right)} of ${viewport})`);
    const style = getComputedStyle(el);
    if (style.display !== 'inline' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) spills.add(`${name(el)} holds content ${el.scrollWidth - el.clientWidth}px wider than itself`);
    if (style.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1) spills.add(`${name(el)} cuts off ${el.scrollHeight - el.clientHeight}px of its content`);
  }
  return [...spills];
}
