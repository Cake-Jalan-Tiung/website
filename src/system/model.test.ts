import {describe, expect, expectTypeOf, it} from 'vitest';
import {contrast, forbiddenText, hex, legalText, renderedHex, type Ground, type GroundFor, type TextInk} from './model';

const pairs = Object.entries(legalText).flatMap(([ground, inks]) =>
  inks.map((ink) => ({ground: ground as Ground, ink: ink as TextInk})),
);

describe('legal text pairings', () => {
  it.each(pairs)('$ink on $ground clears AA 4.5:1', ({ink, ground}) => {
    expect(contrast(renderedHex(ink, ground), hex[ground])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(forbiddenText)('$ink on $ground stays below AA: $reason', ({ink, ground}) => {
    expect(contrast(renderedHex(ink, ground), hex[ground])).toBeLessThan(4.5);
  });

  it('muted fails on cream-100 and chalk, so neither lists it', () => {
    expect(contrast(hex.muted, hex['cream-100'])).toBeLessThan(4.5);
    expect(contrast(hex.muted, hex.chalk)).toBeLessThan(4.5);
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
    expect(contrast(hex[ink], hex[ground])).toBeCloseTo(printed, 1);
  });

  it('cobalt on teh is 4.55:1, not the 4.6 printed on sheet 06', () => {
    expect(contrast(hex.blue, hex.teh)).toBeCloseTo(4.55, 2);
  });
});

describe('Law 04 in the types', () => {
  it('edible marks may only sit on paper or cream-100', () => {
    expectTypeOf<GroundFor<'edible'>>().toEqualTypeOf<'paper' | 'cream-100'>();
    expectTypeOf<GroundFor<'alive'>>().toEqualTypeOf<Ground>();
  });
});

describe('menu board inks (Mock up 03)', () => {
  it('warm grey descriptions on ink clear AA', () => {
    expect(contrast('#9A9082', hex.ink)).toBeGreaterThanOrEqual(4.5);
  });
});
