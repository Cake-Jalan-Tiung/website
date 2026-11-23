import {describe, expect, expectTypeOf, it} from 'vitest';
import {marks} from '../marks/marks.generated';
import {contrast, edibleGrounds, forbiddenText, legalText, renderedHex, wordmarkInk, type Ground, type GroundFor, type TextInk} from './model';
import {color} from './tokens';
import themeSettings from '../../themes/cjt/cjt.settings.json?raw';

const pairs = Object.entries(legalText).flatMap(([ground, inks]) =>
  inks.map((ink) => ({ground: ground as Ground, ink: ink as TextInk})),
);

describe('legal text pairings', () => {
  it.each(pairs)('$ink on $ground clears AA 4.5:1', ({ink, ground}) => {
    expect(contrast(renderedHex(ink, ground), color[ground])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(forbiddenText)('$ink on $ground stays below AA: $reason', ({ink, ground}) => {
    expect(contrast(renderedHex(ink, ground), color[ground])).toBeLessThan(4.5);
  });

  it('muted fails on cream-100 and chalk, so neither lists it', () => {
    expect(contrast(color.muted, color['cream-100'])).toBeLessThan(4.5);
    expect(contrast(color.muted, color.chalk)).toBeLessThan(4.5);
  });
});

describe('figures printed in Paper', () => {
  it.each([
    ['ink', 'paper', 18.9],
    ['blue', 'paper', 8.1],
    ['muted', 'paper', 4.5],
    ['ink', 'cream-400', 14.7],
    ['blue', 'cream-400', 6.3],
    ['pink', 'ink', 6.3],
    ['blue', 'blue-50', 7.2],
    ['blue', 'pandan', 4.9],
  ] as const)('%s on %s is %s:1 (sheets 05 and 06)', (ink, ground, printed) => {
    expect(contrast(color[ink], color[ground])).toBeCloseTo(printed, 1);
  });

  it('cobalt on teh is 4.55:1, not the 4.6 printed on sheet 06', () => {
    expect(contrast(color.blue, color.teh)).toBeCloseTo(4.55, 2);
  });
});

describe('Law 04 in the types', () => {
  it('edible marks may only sit on paper or cream-100', () => {
    expectTypeOf<GroundFor<'edible'>>().toEqualTypeOf<'paper' | 'cream-100'>();
    expectTypeOf<GroundFor<'alive'>>().toEqualTypeOf<Ground>();
  });

  it.each(marks.filter((m) => m.engine === 'edible'))('$name is registered on a ground lighter than its fill', ({ground}) => {
    expect(edibleGrounds).toContain(ground);
  });
});

describe('the marks registry', () => {
  // Cobalt-lined marks need a ground cobalt reads on; the reversed drawings are for ink.
  it.each(marks.filter((m) => !m.name.endsWith('Mono')))('$name reads on its ground', ({name, ground}) => {
    expect(wordmarkInk(ground)).toBe(name.endsWith('Reversed') ? 'cream-400' : 'blue');
  });
});

describe('the typeset wordmark', () => {
  it.each(Object.keys(legalText) as Ground[])('reads on %s', (ground) => {
    expect(contrast(color[wordmarkInk(ground)], color[ground])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the Astryx theme settings', () => {
  // The editor owns cjt.settings.json and stores colours as literals, so they are held to tokens.ts here.
  // The one exception: Astryx refused #767676 as secondary text on its muted surfaces (docs/design-system.md, Decisions).
  const astryxSecondary = '#6D6D6D';
  const brand = new Set<string>([...Object.values(color), astryxSecondary]);
  const used = [...new Set([...themeSettings.matchAll(/#[0-9a-f]{6}/gi)].map(([hex]) => hex.toUpperCase()))];

  it.each(used)('%s is a brand colour', (hex) => {
    expect(brand).toContain(hex);
  });
});
