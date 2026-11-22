// Every brand value, once. Read from the Paper file "Cake Jalan Tiung" (pages Concept,
// Grammar and Mock up). themes/cjt/cjt.theme.ts publishes `cssTokens` as --cjt-* custom
// properties; the model, the marks generator and the specimen read the same objects.
// Keep this file free of imports and of syntax Node cannot strip: scripts import it directly.

/** Names follow Grammar sheet 05 (roles) and sheet 06 (wash, flavours). */
export const color = {
  ink: '#111111',
  muted: '#767676',
  rule: '#E4E4E4',
  paper: '#FFFFFF',
  blue: '#031CFE',
  'blue-50': '#EFF1FF',
  'blue-100': '#DADEFF',
  'blue-200': '#B7BFFF',
  pink: '#F75D9A',
  'cream-100': '#FEF6E6',
  'cream-200': '#FFF6E0',
  'cream-400': '#FAE0AF',
  chalk: '#F4F4F2',
  pandan: '#5FE0A4',
  gula: '#FFC24D',
  ais: '#4FDDDD',
  ube: '#CDBCFF',
  teh: '#FFB08A',
  // On ink only (Mock up 03): the hairline and the secondary text of the menu board.
  'rule-reversed': '#4A4136',
  'ink-muted': '#9A9082',
} as const;
export type ColorName = keyof typeof color;

/** Sheet 05: where muted fails (cream-400, chalk), secondary text is ink at this opacity. */
export const inkSoftAlpha = 0.6;

export const weight = {regular: 400, medium: 500} as const;

/** Letter-spacing in em. */
export const tracking = {caps: 0.18, 'caps-wide': 0.2, tight: -0.03} as const;

export type TypeStep = {size: number; leading: number; weight: keyof typeof weight; tracking?: keyof typeof tracking; caps?: true};

const steps = {
  label: {size: 11, leading: 14, weight: 'regular', tracking: 'caps', caps: true},
  caption: {size: 13, leading: 16, weight: 'regular'},
  body: {size: 15, leading: 24, weight: 'regular'},
  subhead: {size: 24, leading: 28, weight: 'regular'},
  head: {size: 40, leading: 42, weight: 'medium', tracking: 'tight'},
  display: {size: 68, leading: 70, weight: 'medium', tracking: 'tight'},
} as const satisfies Record<string, TypeStep>;
export type TypeRole = keyof typeof steps;

/** Grammar sheet 04: six steps, two weights. Size and leading in px at a 16px root. */
export const typeScale: Record<TypeRole, TypeStep> = steps;

/** Spacing steps in px. */
export const space = {xs: 8, sm: 16, md: 24, lg: 40, xl: 64, '2xl': 96, '3xl': 128} as const;

/** The Grammar sheet scaffold, in px: 96 gutters, 1248 content, 128 between sections. */
export const layout = {
  measure: 520,
  tile: 400,
  content: 1248,
  sheet: 1440,
  gutter: space['2xl'],
  section: space['3xl'],
} as const;

/** Stroke weights of the drawn marks at their Paper size, in px. */
export const stroke = {contour: 7, limb: 5, texture: 3.5} as const;

/** Sheets 04 and 14: below these rendered sizes (px) an asset switches to its fallback. */
export const minSize = {
  'wordmark-drawn': 180,
  'lockup-crowned': 240,
  object: 64,
  'pink-accent': 40,
  // Burung Tiung: the icon (heavier lines, no texture) is for this size and under.
  'bird-icon': 32,
} as const;

export const colorVar = (name: ColorName) => `var(--cjt-color-${name})` as const;

const px = (n: number) => `${n}px`;
const rem = (n: number) => `${n / 16}rem`;
const em = (n: number) => `${n}em`;

function named<V>(prefix: string, values: Record<string, V>, format: (value: V) => string): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [`--cjt-${prefix}-${name}`, format(value)]));
}

const typeTokens = Object.fromEntries(
  Object.entries(typeScale).flatMap(([role, step]) => [
    [`--cjt-text-${role}`, rem(step.size)],
    [`--cjt-leading-${role}`, rem(step.leading)],
    [`--cjt-weight-${role}`, String(weight[step.weight])],
    [`--cjt-tracking-${role}`, step.tracking ? em(tracking[step.tracking]) : 'normal'],
    [`--cjt-case-${role}`, step.caps ? 'uppercase' : 'none'],
  ]),
);

/** The custom properties the theme publishes. */
export const cssTokens: Record<string, string> = {
  ...named('color', color, String),
  '--cjt-color-ink-60': `color-mix(in srgb, ${color.ink} ${inkSoftAlpha * 100}%, transparent)`,
  ...named('weight', weight, String),
  ...named('tracking', tracking, em),
  ...typeTokens,
  ...named('space', space, px),
  '--cjt-space-gutter': px(layout.gutter),
  '--cjt-space-section': px(layout.section),
  '--cjt-measure': px(layout.measure),
  '--cjt-container-tile': px(layout.tile),
  '--cjt-container-content': px(layout.content),
  '--cjt-container-sheet': px(layout.sheet),
  ...named('stroke', stroke, px),
  ...named('min', minSize, px),
};
