// Turns the SVGs exported from Paper (assets/marks) into themed React components
// (src/marks/marks.generated.tsx). Brand hex values become --cjt-color-* tokens so
// the marks follow the theme. Run: pnpm marks
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// size is the size each mark is drawn at in Paper. Its width is the default width;
// height follows from the viewBox, so setting only a width keeps the proportions.
const MARKS = [
  {name: 'PrimaryLockup', label: 'Cake Jalan Tiung', family: 'logo', engine: 'lettering', note: 'Crest, name and promise together', layers: ['primary-lockup'], size: [800, 519]},
  {name: 'StackedLockup', label: 'Cake Jalan Tiung, stacked', family: 'logo', engine: 'lettering', note: 'When we need to go tall', layers: ['stacked-lockup'], size: [400, 405]},
  {name: 'TiungCat', label: 'Tiung the cat', family: 'logo', engine: 'alive', note: 'Our little mascot', layers: ['tiung-cat'], size: [326, 405]},
  {name: 'BurungTiung', label: 'Burung Tiung', family: 'tiung', engine: 'alive', note: 'Perched, mid-song, facing left', layers: ['burung-tiung'], size: [545, 576]},
  {name: 'BurungTiungReversed', label: 'Burung Tiung, reversed', family: 'tiung', engine: 'alive', note: 'White lines on ink, pink beak kept', layers: ['burung-tiung-reversed'], size: [232, 245]},
  {name: 'BurungTiungMono', label: 'Burung Tiung, single colour', family: 'tiung', engine: 'alive', note: 'For stamps, embossing, receipts', layers: ['burung-tiung-mono'], size: [232, 245]},
  {name: 'BurungTiungIcon', label: 'Burung Tiung icon', family: 'tiung', engine: 'alive', note: 'Heavier lines, for 32px and under', layers: ['burung-tiung-icon'], size: [190, 200]},
  {name: 'BurungTiungFilled', label: 'Burung Tiung, filled', family: 'tiung', engine: 'alive', note: 'The little bird we’re named after', layers: ['burung-tiung-filled'], size: [400, 505]},
  {name: 'CrownedTiung', label: 'Crowned Tiung', family: 'crowned', engine: 'alive', note: 'Head in profile, wearing a cake for a crown', layers: ['crowned-tiung'], size: [430, 400]},
  {name: 'CrownedTiungReversed', label: 'Crowned Tiung, reversed', family: 'crowned', engine: 'alive', note: 'White lines on ink, pink beak kept', layers: ['crowned-tiung-reversed'], size: [210, 255]},
  {name: 'CrownedTiungMono', label: 'Crowned Tiung, single colour', family: 'crowned', engine: 'alive', note: 'Everything in one weight of ink', layers: ['crowned-tiung-mono'], size: [210, 255]},
  {name: 'ShioPan', label: 'Shio Pan', family: 'pastry', engine: 'edible', note: 'Salt roll, buttery centre', layers: ['shio-pan'], size: [250, 250]},
  {name: 'ButterTteok', label: 'Butter Tteok', family: 'pastry', engine: 'edible', note: 'Chewy, buttery, gone fast', layers: ['butter-tteok'], size: [258, 258]},
  {name: 'Croissant', label: 'Croissant', family: 'pastry', engine: 'edible', note: 'Twenty-seven layers', layers: ['croissant'], size: [178, 178]},
  // Drinks are two Paper SVGs stacked at the same origin: the vessel at its own size,
  // the scatter at 250px. scale converts the scatter into the vessel's coordinates.
  {name: 'Coffee', label: 'Coffee', family: 'drink', engine: 'edible', note: 'Kopi, with crema on top', layers: ['coffee-cup', {file: 'coffee-beans', scale: 250 / 242}], size: [242, 242]},
  {name: 'Tea', label: 'Tea', family: 'drink', engine: 'edible', note: 'Steeping, tag still on', layers: ['tea-glass', {file: 'tea-leaves', scale: 250 / 258}], size: [258, 258]},
  {name: 'HotChocolate', label: 'Hot Chocolate', family: 'drink', engine: 'edible', note: 'Cream on top, always', layers: ['hot-chocolate-mug', {file: 'hot-chocolate-cubes', scale: 250 / 262}], size: [262, 262]},
];

// Each colour reads a --cjt-mark-* slot first, so one mark can be recoloured
// (e.g. cream on the cobalt awning) by setting the slot, with no token cycle.
const TOKEN_FOR_HEX = Object.fromEntries(
  Object.entries({
    '#031CFE': 'blue',
    '#F75D9A': 'pink',
    '#FAE0AF': 'cream',
    '#FFF6E0': 'cream-200',
    '#111111': 'ink',
    '#FFFFFF': 'paper',
  }).map(([hex, name]) => [hex, `var(--cjt-mark-${name}, var(--cjt-color-${name}))`]),
);

const CHILD_TAGS = new Set(['g', 'path', 'circle', 'ellipse']);
const JSX_ATTR = {
  d: 'd', cx: 'cx', cy: 'cy', r: 'r', rx: 'rx', ry: 'ry', transform: 'transform',
  'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin',
};

function parseAttrs(source, file) {
  const attrs = {};
  const rest = source.replace(/([a-zA-Z:-]+)="([^"]*)"/g, (_, key, value) => {
    attrs[key] = value;
    return '';
  });
  if (rest.trim() !== '') throw new Error(`${file}: unparsed attribute text "${rest.trim()}"`);
  return attrs;
}

function readSvg(file) {
  const source = readFileSync(`${root}assets/marks/${file}.svg`, 'utf8');
  const elements = [...source.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)].map(([, close, tag, attrs, selfClose]) => ({
    tag, close: close === '/', selfClose: selfClose === '/', attrs: close ? {} : parseAttrs(attrs, file),
  }));
  const [rootEl] = elements;
  if (rootEl?.tag !== 'svg') throw new Error(`${file}: does not start with <svg>`);
  const children = elements.slice(1, -1);
  for (const el of children) {
    if (!CHILD_TAGS.has(el.tag)) throw new Error(`${file}: unexpected <${el.tag}>`);
  }
  return {viewBox: rootEl.attrs.viewBox, overflowVisible: /overflow:\s*visible/.test(rootEl.attrs.style ?? ''), children};
}

function jsxElement(el) {
  if (el.close) return `</${el.tag}>`;
  const props = [];
  const style = {};
  for (const [key, value] of Object.entries(el.attrs)) {
    if (key === 'fill' || key === 'stroke') {
      const token = TOKEN_FOR_HEX[value.toUpperCase()];
      if (token) style[key] = token;
      else props.push(`${key}="${value}"`);
    } else if (key === 'style') {
      const opacity = value.match(/^opacity:\s*([\d.]+)$/);
      if (!opacity) throw new Error(`unexpected style "${value}"`);
      props.push(`opacity="${opacity[1]}"`);
    } else if (JSX_ATTR[key]) {
      props.push(`${JSX_ATTR[key]}="${value}"`);
    } else {
      throw new Error(`unexpected attribute ${key} on <${el.tag}>`);
    }
  }
  const styleEntries = Object.entries(style);
  if (styleEntries.length > 0) {
    props.push(`style={{${styleEntries.map(([k, v]) => `${k}: '${v}'`).join(', ')}}}`);
  }
  return `<${el.tag}${props.length ? ' ' + props.join(' ') : ''}${el.selfClose ? ' />' : '>'}`;
}

function component(mark) {
  if (!['alive', 'edible', 'lettering'].includes(mark.engine)) throw new Error(`${mark.name}: missing engine`);
  const [base, ...overlays] = mark.layers.map((layer) => (typeof layer === 'string' ? {file: layer} : layer));
  const svg = readSvg(base.file);
  const body = [svg.children.map(jsxElement).join('')];
  for (const overlay of overlays) {
    const layer = readSvg(overlay.file);
    if (layer.viewBox !== svg.viewBox) throw new Error(`${overlay.file}: viewBox differs from ${base.file}`);
    body.push(`<g transform="scale(${overlay.scale.toFixed(4)})">${layer.children.map(jsxElement).join('')}</g>`);
  }
  const overflow = svg.overflowVisible ? ' overflow="visible"' : '';
  return `export function ${mark.name}({title = ${JSON.stringify(mark.label)}, ...props}: MarkProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${svg.viewBox}" width={${mark.size[0]}}${overflow} role="img" aria-label={title} {...props}>
      ${body.join('\n      ')}
    </svg>
  );
}`;
}

const output = `// Generated by scripts/build-marks.mjs from assets/marks. Do not edit; run \`pnpm marks\`.
import type {ComponentType, SVGProps} from 'react';

export type MarkProps = SVGProps<SVGSVGElement> & {title?: string};
export type MarkFamily = 'logo' | 'tiung' | 'crowned' | 'pastry' | 'drink';
export type MarkEngine = 'alive' | 'edible' | 'lettering';
export type MarkEntry = {name: string; label: string; note: string; family: MarkFamily; engine: MarkEngine; Component: ComponentType<MarkProps>};

${MARKS.map(component).join('\n\n')}

export const marks: readonly MarkEntry[] = [
${MARKS.map((m) => `  {name: '${m.name}', label: ${JSON.stringify(m.label)}, note: ${JSON.stringify(m.note)}, family: '${m.family}', engine: '${m.engine}', Component: ${m.name}},`).join('\n')}
];
`;

writeFileSync(`${root}src/marks/marks.generated.tsx`, output);
console.log(`wrote src/marks/marks.generated.tsx (${MARKS.length} marks)`);
