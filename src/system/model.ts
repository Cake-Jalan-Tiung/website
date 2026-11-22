// The rules of the Cake Jalan Tiung brand as data. Sources: Paper file "Cake Jalan
// Tiung", page Grammar (sheet numbers below) and page Concept.

/** A surface something can sit on. Sheet 05 (paper, creams, ink), sheet 06 (wash, flavours). */
export type Flavour = 'pandan' | 'gula' | 'ais' | 'ube' | 'teh';
export type Ground =
  | 'paper'
  | 'cream-100'
  | 'cream-400'
  | 'chalk'
  | 'ink'
  | 'blue-50'
  | 'blue-100'
  | 'blue-200'
  | Flavour;

/** A colour text can be set in. `ink-60` is ink at 60% opacity (sheet 05, on cream-400). */
export type TextInk = 'ink' | 'blue' | 'muted' | 'paper' | 'cream' | 'pink' | 'ink-60';

export const hex = {
  paper: '#FFFFFF',
  ink: '#111111',
  muted: '#767676',
  rule: '#E4E4E4',
  blue: '#031CFE',
  pink: '#F75D9A',
  cream: '#FAE0AF',
  'cream-100': '#FEF6E6',
  'cream-200': '#FFF6E0',
  'cream-400': '#FAE0AF',
  chalk: '#F4F4F2',
  'blue-50': '#EFF1FF',
  'blue-100': '#DADEFF',
  'blue-200': '#B7BFFF',
  pandan: '#5FE0A4',
  gula: '#FFC24D',
  ais: '#4FDDDD',
  ube: '#CDBCFF',
  teh: '#FFB08A',
  'rule-reversed': '#4A4136',
} as const;

export const groundToken: Record<Ground, string> = {
  paper: 'var(--cjt-color-paper)',
  'cream-100': 'var(--cjt-color-cream-100)',
  'cream-400': 'var(--cjt-color-cream)',
  chalk: 'var(--cjt-color-chalk)',
  ink: 'var(--cjt-color-ink)',
  'blue-50': 'var(--cjt-color-blue-50)',
  'blue-100': 'var(--cjt-color-blue-100)',
  'blue-200': 'var(--cjt-color-blue-200)',
  pandan: 'var(--cjt-color-pandan)',
  gula: 'var(--cjt-color-gula)',
  ais: 'var(--cjt-color-ais)',
  ube: 'var(--cjt-color-ube)',
  teh: 'var(--cjt-color-teh)',
};

export const inkToken: Record<TextInk, string> = {
  ink: 'var(--cjt-color-ink)',
  blue: 'var(--cjt-color-blue)',
  muted: 'var(--cjt-color-muted)',
  paper: 'var(--cjt-color-paper)',
  cream: 'var(--cjt-color-cream)',
  pink: 'var(--cjt-color-pink)',
  'ink-60': 'color-mix(in srgb, var(--cjt-color-ink) 60%, transparent)',
};

/**
 * Which text colours may sit on which ground, for body-size text (AA 4.5:1).
 * Sheet 05: paper takes ink, blue, muted; cream-400 takes ink and blue, muted is
 * illegal there (use ink-60); ink takes paper, cream and pink, never blue.
 * Sheet 06: blue-50 and blue-100 take ink and blue; blue-200 takes ink only for
 * body; every flavour takes ink, with a cobalt wordmark.
 * cream-100 and chalk are not on sheet 05; their entries are set by measured contrast
 * (muted fails on both, so the Never tag on chalk uses ink-60).
 */
export const legalText = {
  paper: ['ink', 'blue', 'muted'],
  'cream-100': ['ink', 'blue'],
  'cream-400': ['ink', 'blue', 'ink-60'],
  chalk: ['ink', 'blue', 'ink-60'],
  ink: ['paper', 'cream', 'pink'],
  'blue-50': ['ink', 'blue'],
  'blue-100': ['ink', 'blue'],
  'blue-200': ['ink'],
  pandan: ['ink'],
  gula: ['ink'],
  ais: ['ink'],
  ube: ['ink'],
  teh: ['ink'],
} as const satisfies Record<Ground, readonly TextInk[]>;

export type LegalText<G extends Ground> = (typeof legalText)[G][number];

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
export type GroundFor<E extends Engine> = E extends 'edible' ? 'paper' | 'cream-100' : Ground;

/** Sheets 04 and 14: below these rendered sizes an asset switches to its fallback. */
export const minSize = {
  drawnWordmark: 180,
  crownedLockup: 240,
  edibleObject: 64,
  pinkAccent: 40,
  // Burung Tiung: the small-size icon (heavier lines, no texture) is for 32px and under.
  birdIcon: 32,
} as const;

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
  if (ink !== 'ink-60') return hex[ink];
  const g = hex[ground];
  const mix = (i: number) => {
    const fg = parseInt(hex.ink.slice(i, i + 2), 16);
    const bg = parseInt(g.slice(i, i + 2), 16);
    return Math.round(fg * 0.6 + bg * 0.4).toString(16).padStart(2, '0');
  };
  return `#${mix(1)}${mix(3)}${mix(5)}`.toUpperCase();
}
