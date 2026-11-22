// The rules of the Cake Jalan Tiung brand as data. Sources: Paper file "Cake Jalan
// Tiung", page Grammar (sheet numbers below) and page Concept. Values live in tokens.ts.
import {color, inkSoftAlpha, type ColorName} from './tokens';

export type Flavour = Extract<ColorName, 'pandan' | 'gula' | 'ais' | 'ube' | 'teh'>;

/** A surface something can sit on. Sheet 05 (paper, creams, ink), sheet 06 (wash, flavours). */
export type Ground = Extract<ColorName, 'paper' | 'cream-100' | 'cream-400' | 'chalk' | 'ink' | 'blue' | 'blue-50' | 'blue-100' | 'blue-200'> | Flavour;

/**
 * A colour text can be set in. `ink-60` is ink at 60% opacity (sheet 05, on cream-400);
 * `ink-muted` is the warm grey of the menu board's English (Mock up 03).
 */
export type TextInk = Extract<ColorName, 'ink' | 'blue' | 'muted' | 'paper' | 'cream-400' | 'pink' | 'ink-muted'> | 'ink-60';

/**
 * Which text colours may sit on which ground, for body-size text (AA 4.5:1). The
 * first is the ground's primary voice.
 * Sheet 05: paper takes ink, blue, muted; cream-400 takes ink and blue, muted is
 * illegal there (use ink-60); ink takes paper, cream and pink, never blue.
 * Mock up 03: on ink the text is cream, and English sits in the warm grey (ink-muted).
 * Sheet 06: blue-50 and blue-100 take ink and blue; blue-200 takes ink only for
 * body; every flavour takes ink. The typeset wordmark is identity, not text, and
 * follows `wordmarkInk` instead.
 * cream-100 and chalk are not on sheet 05; their entries are set by measured contrast
 * (muted fails on both, so the Never tag on chalk uses ink-60). Blue is the awning:
 * the only thing Paper sets on it is cream.
 */
export const legalText = {
  paper: ['ink', 'blue', 'muted'],
  'cream-100': ['ink', 'blue'],
  'cream-400': ['ink', 'blue', 'ink-60'],
  chalk: ['ink', 'blue', 'ink-60'],
  ink: ['cream-400', 'paper', 'pink', 'ink-muted'],
  blue: ['cream-400'],
  'blue-50': ['ink', 'blue'],
  'blue-100': ['ink', 'blue'],
  'blue-200': ['ink'],
  pandan: ['ink'],
  gula: ['ink'],
  ais: ['ink'],
  ube: ['ink'],
  teh: ['ink'],
} as const satisfies Record<Ground, readonly TextInk[]>;

/**
 * The receding voice on a ground: muted on paper, ink at 60% where muted fails, warm
 * grey on ink. Where the table allows no receding ink, the primary voice carries it.
 */
export function secondaryInk(ground: Ground): TextInk {
  const legal: readonly TextInk[] = legalText[ground];
  return (['muted', 'ink-60', 'ink-muted'] as const).find((ink) => legal.includes(ink)) ?? legal[0];
}

/** Sheets 04 and 06: the wordmark is cobalt on every light ground, cream where cobalt cannot read. */
export const wordmarkInk = (ground: Ground): Extract<TextInk, 'blue' | 'cream-400'> => (ground === 'ink' || ground === 'blue' ? 'cream-400' : 'blue');

/** Sheet 05 "Four things that are never done", as pairs that must stay below AA. */
export const forbiddenText: ReadonlyArray<{ink: TextInk; ground: Ground; reason: string}> = [
  {ink: 'pink', ground: 'cream-400', reason: 'Pink text on cream dissolves (2.3:1).'},
  {ink: 'blue', ground: 'ink', reason: 'Blue text on ink is unreadable (2.3:1).'},
  {ink: 'muted', ground: 'cream-400', reason: 'Muted on cream fails (3.5:1); use ink at 60%.'},
];

/**
 * Law 04, three engines. Alive things are stroked and work on any ground. Edible
 * things are an offset fill (cobalt outside, cream-200 inside) and must sit on a
 * ground lighter than the fill: paper or cream-100. Lettering is filled outline.
 */
export type Engine = 'alive' | 'edible' | 'lettering';
export const edibleGrounds = ['paper', 'cream-100'] as const satisfies readonly Ground[];
export type GroundFor<E extends Engine> = E extends 'edible' ? (typeof edibleGrounds)[number] : Ground;
/** A drawing and a ground it may legally sit on. */
export type Staged = {[E in Engine]: {engine: E; ground: GroundFor<E>}}[Engine];

/** WCAG 2 relative luminance contrast between two #RRGGBB colours. */
export function contrast(a: string, b: string): number {
  const luminance = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Resolves a text ink to the hex it renders as on a given ground (ink-60 is blended). */
export function renderedHex(ink: TextInk, ground: Ground): string {
  if (ink !== 'ink-60') return color[ink];
  const mix = (i: number) => {
    const fg = parseInt(color.ink.slice(i, i + 2), 16);
    const bg = parseInt(color[ground].slice(i, i + 2), 16);
    return Math.round(fg * inkSoftAlpha + bg * (1 - inkSoftAlpha)).toString(16).padStart(2, '0');
  };
  return `#${mix(1)}${mix(3)}${mix(5)}`.toUpperCase();
}
