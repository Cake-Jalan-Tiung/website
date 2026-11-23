import type {ComponentType, CSSProperties, ReactNode} from 'react';
import {BurungTiung, BurungTiungIcon, BurungTiungMono, BurungTiungReversed, PrimaryLockup, StackedLockup, type MarkEntry, type MarkProps} from '../marks/marks.generated';
import {Field, useGround} from './Field';
import {legalText, wordmarkInk, type Flavour, type Ground, type Staged, type TextInk} from './model';
import {color, colorVar, minSize, type ColorName, type space} from './tokens';
import {Type, type TypeRole} from './Type';
import c from './components.module.css';
import t from './type.module.css';

export type Bilingual = {bm: string; en: string};

const cx = (...names: Array<string | undefined>) => names.filter(Boolean).join(' ');

/* ---------- Text patterns ---------- */

/** Small spaced capitals. Grammar sheet 04: only ever uppercase, only ever tracked. */
export function Label({children, ink, as, id, lang}: {children: ReactNode; ink?: TextInk | 'secondary'; as?: 'span' | 'p' | 'h2' | 'h3'; id?: string; lang?: string}) {
  return (
    <Type role="label" ink={ink} as={as} id={id} lang={lang}>
      {children}
    </Type>
  );
}

/** Concept statement: the page's one display line and the sentence under it. A line break in `title` is kept. */
export function Statement({title, lede}: {title: string; lede?: ReactNode}) {
  return (
    <div className={c.statement} data-cjt="statement">
      <Type role="display" as="h1" className={c.title}>
        {title}
      </Type>
      {lede ? (
        <Type role="body" as="p" className={c.lede} data-cjt="lede">
          {lede}
        </Type>
      ) : null}
    </div>
  );
}

/** Concept page masthead over the statement; Grammar sheet scaffold. */
export function PageHeader({meta, aside, title, lede}: {meta: [string, string]; aside?: string; title: string; lede?: ReactNode}) {
  return (
    <header className={c.pageHeader} data-cjt="page-header">
      <div className={c.metaRow}>
        <div className={c.metaStack}>
          <Label ink="secondary">{meta[0]}</Label>
          <Label>{meta[1]}</Label>
        </div>
        {aside ? <Label ink="secondary">{aside}</Label> : null}
      </div>
      <Statement title={title} lede={lede} />
    </header>
  );
}

/** The header every Paper section opens with: label, caption, a rule-in-a-phrase, a hairline. */
export function SectionHeader({
  label,
  caption,
  meta,
  level = 2,
  id,
  lang,
}: {
  label: string;
  caption?: string;
  meta?: string;
  level?: 2 | 3;
  id?: string;
  /** The label's language, when it is not the page's. */
  lang?: string;
}) {
  return (
    <div className={c.sectionHeader} data-cjt="section-header">
      <Label as={level === 2 ? 'h2' : 'h3'} id={id} lang={lang}>
        {label}
      </Label>
      {caption ? (
        <Type role="caption" ink="secondary" className={c.sectionCaption}>
          {caption}
        </Type>
      ) : null}
      {meta ? (
        <span className={c.sectionMeta}>
          <Label ink="secondary">{meta}</Label>
        </span>
      ) : null}
    </div>
  );
}

/** Grammar sheet 15, form 01: the middot pair, for labels. Malay leads, English recedes. */
export function BilingualLabel({label}: {label: Bilingual}) {
  return (
    <Type role="label">
      <span lang="ms">{label.bm}</span>
      <Type role="label" ink="secondary">
        {' · '}
        {label.en}
      </Type>
    </Type>
  );
}

/**
 * Grammar sheet 15, form 02: the stacked pair, the default for menus. Malay is the line,
 * English sits under it. With `as` the Malay line is a heading, and `id` names it.
 * The English recedes only where a receding ink is legal.
 */
export function StackedPair({label, role = 'subhead', as, id}: {label: Bilingual; role?: Extract<TypeRole, 'subhead' | 'head'>; as?: 'h2' | 'h3'; id?: string}) {
  const Pair = as ? 'div' : 'span';
  return (
    <Pair className={c.stacked}>
      <Type role={role} lang="ms" as={as} id={id}>
        {label.bm}
      </Type>
      <Type role="caption" ink="secondary">
        {label.en}
      </Type>
    </Pair>
  );
}

/** Text for screen readers only. */
export function VisuallyHidden({children}: {children: ReactNode}) {
  return <span className={c.visuallyHidden}>{children}</span>;
}

/** A bare numeral, as on the menu board: whole ringgit alone, sen to two places. Screen readers hear the currency. */
export function Price({amount, ink, role = 'subhead', className}: {amount: number; ink?: TextInk; role?: TypeRole; className?: string}) {
  return (
    <Type role={role} ink={ink} className={cx(c.price, className)}>
      <VisuallyHidden>RM </VisuallyHidden>
      {Number.isInteger(amount) ? amount : amount.toFixed(2)}
    </Type>
  );
}

/** Mock up 03 and Grammar sheet 06: the 9px pink dot beside a wordmark or a voice line. */
export function PinkDot() {
  return <span aria-hidden className={c.dot} />;
}

/**
 * A hairline, or the marker rule that opens a section: cobalt, at the weight of a drawn
 * contour. Grammar sheet 05 gives every structural line to the Artline marker.
 */
export function Rule({tone = 'default'}: {tone?: 'default' | 'marker'}) {
  return <hr className={c.rule} data-tone={tone} />;
}

/* ---------- Wordmarks and marks ---------- */

/**
 * Grammar sheet 04: Jost Medium, capitals, 0.2em. The fallback for the drawn lockup.
 * It is identity, not text, so it takes its colour from the ground, not from an ink prop.
 * `mono` is for print that has only ink, such as a thermal receipt: like the single-colour
 * bird, it is ink wherever it is put.
 */
export function TypesetWordmark({role = 'caption', mono = false}: {role?: Exclude<TypeRole, 'display'>; mono?: boolean}) {
  const ground = useGround();
  const legal: readonly TextInk[] = legalText[ground];
  if (import.meta.env.DEV && mono && !legal.includes('ink')) console.error(`cjt: the mono wordmark is ink, which is not legal on ${ground}.`);
  return (
    <span className={cx(t[role], t.wordmark, t[mono ? 'ink' : wordmarkInk(ground)])} data-cjt="wordmark">
      Cake Jalan Tiung
    </span>
  );
}

/**
 * Where cobalt cannot read (ink, the cobalt awning), a mark's colour slots swap: its
 * cobalt lines take `lines`, and its cream fill takes the ground so it reads as a cut-out.
 * Paper drew this only for the bird and the crowned head; the rest is the same swap.
 */
function reversedSlots(ground: Ground, lines: ColorName): CSSProperties | undefined {
  if (wordmarkInk(ground) === 'blue') return undefined;
  return {'--cjt-mark-blue': colorVar(lines), '--cjt-mark-cream-400': colorVar(ground)} as CSSProperties;
}

/**
 * The lockup at a rendered width. Grammar sheet 04: below 180px the drawn letters stop
 * reading, so the typeset wordmark stands in. Never retyped above it. `stacked` is the
 * tall lockup, for when we need to go tall. On ink and on the cobalt awning it is drawn
 * in cream, like the wordmark.
 */
export function Logo({width, stacked = false}: {width: number; stacked?: boolean}) {
  const ground = useGround();
  if (width < minSize['wordmark-drawn']) return <TypesetWordmark />;
  const Lockup = stacked ? StackedLockup : PrimaryLockup;
  return <Lockup width={width} className={c.logo} style={reversedSlots(ground, 'cream-400')} />;
}

/**
 * Burung Tiung at a rendered size. Grammar sheet 14 and the Concept variants: at 32px
 * and under, the small-size icon (heavier lines, no feather texture) replaces it.
 * On ink it is the reversed drawing: white lines, pink beak kept. Paper drew no
 * reversed icon and nothing for cobalt, so there the lines are recoloured the same way.
 * `mono` is the one-colour drawing for print, and is ink wherever it is put.
 */
export function Tiung({size, mono = false, ...rest}: {size: number; mono?: boolean} & Omit<MarkProps, 'width' | 'height'>) {
  const ground = useGround();
  const icon = size <= minSize['bird-icon'];
  const drawnReversed = ground === 'ink' && !icon && !mono;
  const Mark = icon ? BurungTiungIcon : mono ? BurungTiungMono : drawnReversed ? BurungTiungReversed : BurungTiung;
  const style = mono || drawnReversed ? undefined : reversedSlots(ground, ground === 'ink' ? 'paper' : 'cream-400');
  return <Mark width={size} height={size} className={c.mark} style={style} {...rest} />;
}

/* ---------- Stages and tiles ---------- */

type FrameProps = {
  ground: Ground;
  height?: number;
  padding?: number;
  tag?: ReactNode;
  /** A mark to fill the stage at its drawn height. Anything else goes in as children. */
  mark?: ComponentType<MarkProps>;
  children?: ReactNode;
};

function Frame({ground, height = 340, padding = 40, tag, mark: Mark, children}: FrameProps) {
  return (
    <Field colour={ground} className={c.stage} style={{'--stage-h': `${height}px`, '--stage-pad': `${padding}px`} as CSSProperties}>
      {tag ? <span className={c.stageTag}>{tag}</span> : null}
      <div className={c.stageArt}>
        {Mark ? <Mark className={c.stageMark} /> : null}
        {children}
      </div>
    </Field>
  );
}

function Captioned({stage, label, caption}: {stage: ReactNode; label: string; caption?: ReactNode}) {
  return (
    <figure className={c.tile} data-cjt="tile">
      {stage}
      <figcaption className={c.tileCaption} data-cjt="tile-caption">
        <Label>{label}</Label>
        {caption ? (
          <Type role="caption" ink="secondary">
            {caption}
          </Type>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** What is drawn, and where. Law 04: edible things may only sit on paper or cream-100. */
export type StageProps = Staged & Omit<FrameProps, 'ground' | 'tag'>;

/** The field a mark sits on. It will not type-check an edible drawing on buttercream. */
export function Stage({engine: _engine, ...frame}: StageProps) {
  return <Frame {...frame} />;
}

/** Stage plus caption, the unit every Paper sheet is built from. */
export function Tile({label, caption, ...stage}: StageProps & {label: string; caption?: ReactNode}) {
  return <Captioned stage={<Stage {...stage} />} label={label} caption={caption} />;
}

/** A registry mark on the ground Paper shows it on (model.test.ts holds the registry to Law 04). */
export function MarkTile({entry, height, padding}: {entry: MarkEntry; height?: number; padding?: number}) {
  return (
    <Captioned
      stage={
        <Frame ground={entry.ground} height={height} padding={padding} mark={entry.Component} />
      }
      label={entry.label}
      caption={entry.note}
    />
  );
}

/* ---------- Artboards ---------- */

type Space = Exclude<keyof typeof space, '3xl'> | 'none';
const inset = (step: Space) => (step === 'none' ? '0' : `var(--cjt-space-${step})`);

export type ArtboardProps = {
  ground: Ground;
  /** The drawn size in px. */
  width: number;
  height: number;
  /** Space around the content; a pair is block, then inline. */
  padding?: Space | readonly [Space, Space];
  /** Paper is outlined on the page; an export has no page, so it turns this off. */
  outlined?: boolean;
  children: ReactNode;
} & {[data: `data-${string}`]: string};

/**
 * A piece drawn at a fixed size: a box lid, a post, a receipt. It clips at its edge like
 * the printed thing, and nothing inside answers to the viewport, so it is the same in a
 * tile and in an export. Its one child fills it.
 */
export function Artboard({ground, width, height, padding = 'md', outlined, children, ...data}: ArtboardProps) {
  const [block, inline] = typeof padding === 'string' ? [padding, padding] : padding;
  const size = {width, height, padding: `${inset(block)} ${inset(inline)}`, '--art-w': `${width}px`, '--art-h': `${height}px`} as CSSProperties;
  return (
    <Field {...data} colour={ground} outlined={outlined} className={c.artboard} style={size}>
      {children}
    </Field>
  );
}

/** An artboard on a chalk stage, shrunk to fit it and never grown past its drawn size, with its caption. */
export function ArtboardTile({label, caption, stage = 440, ...artboard}: ArtboardProps & {label: string; caption?: ReactNode; stage?: number}) {
  return (
    <Captioned
      stage={
        <Frame ground="chalk" height={stage}>
          <div className={c.fit}>
            <Artboard {...artboard} />
          </div>
        </Frame>
      }
      label={label}
      caption={caption}
    />
  );
}

/**
 * Grammar example tiles: Correct on cream-100 with a cobalt tag, Never on chalk with a
 * tag in ink at 60%. The one place a forbidden pairing may be drawn, so it takes no engine.
 */
export function Verdict({
  verdict,
  label,
  caption,
  height = 440,
  mark,
  children,
}: {
  verdict: 'correct' | 'never';
  label: string;
  caption?: ReactNode;
  height?: number;
  mark?: ComponentType<MarkProps>;
  children?: ReactNode;
}) {
  const correct = verdict === 'correct';
  return (
    <Captioned
      stage={
        <Frame ground={correct ? 'cream-100' : 'chalk'} height={height} padding={56} mark={mark} tag={<Label ink={correct ? 'blue' : 'ink-60'}>{correct ? 'Correct' : 'Never'}</Label>}>
          {children}
        </Frame>
      }
      label={label}
      caption={caption}
    />
  );
}

/** Grammar sheet 06: one flavour per surface, as a ground; the identity stays cobalt and pink. */
export function FlavourCard({flavour, name, line}: {flavour: Flavour; name: Bilingual | string; line?: string}) {
  return (
    <Field as="article" colour={flavour} className={c.flavourCard} data-cjt="flavour-card">
      <div className={c.flavourBrand}>
        <TypesetWordmark role="label" />
        <PinkDot />
      </div>
      <div className={c.flavourBody}>
        {typeof name === 'string' ? <Type role="subhead">{name}</Type> : <StackedPair label={name} />}
        {line ? <Type role="caption">{line}</Type> : null}
      </div>
    </Field>
  );
}

/* ---------- Lists ---------- */

export type RuleEntry = {status: 'always' | 'never'; name: string; description: string};

/** Grammar sheet 02 "Custody": what is always and never done. */
export function RuleList({rules}: {rules: readonly RuleEntry[]}) {
  return (
    <ul className={c.list}>
      {rules.map((r) => (
        <li key={r.name} className={c.ruleRow} data-cjt="rule-row">
          <span className={c.ruleStatus}>
            <Label ink={r.status === 'always' ? 'blue' : 'secondary'}>{r.status === 'always' ? 'Always' : 'Never'}</Label>
          </span>
          <Type role="body" className={c.ruleName}>
            {r.name}
          </Type>
          <Type role="caption" ink="secondary" className={c.ruleText}>
            {r.description}
          </Type>
        </li>
      ))}
    </ul>
  );
}

export type ColourRole = {colour: ColorName; name: string; source: string; description: string};

/** Grammar sheet 05 "Roles": each colour, its job, the physical object it came from. */
export function ColourRoles({roles}: {roles: readonly ColourRole[]}) {
  return (
    <ul className={c.list}>
      {roles.map((r) => (
        <li key={r.name} className={c.roleRow} data-cjt="role-row">
          <Field as="span" aria-hidden colour={r.colour} className={c.roleChip} data-cjt="role-chip" />
          <span className={c.roleName}>
            <Label>{r.name}</Label>
            <Type role="caption" ink="secondary">
              {color[r.colour]}
            </Type>
          </span>
          <Type role="caption" className={c.roleSource}>
            {r.source}
          </Type>
          <Type role="caption" ink="secondary" className={c.roleText}>
            {r.description}
          </Type>
        </li>
      ))}
    </ul>
  );
}

/** Concept "Our colours": a chip, its name, its value, and how it prints. */
export function Swatch({name, colour, print = []}: {name: string; colour: ColorName; print?: readonly string[]}) {
  return (
    <figure className={c.swatch} data-cjt="swatch">
      <Field as="span" aria-hidden colour={colour} className={c.swatchChip} data-cjt="swatch-chip" />
      <figcaption className={c.swatchMeta}>
        <Label ink="secondary">{name}</Label>
        <Type role="body">{color[colour]}</Type>
        {print.map((line) => (
          <Type key={line} role="caption" ink="secondary">
            {line}
          </Type>
        ))}
      </figcaption>
    </figure>
  );
}

/* ---------- Menu ---------- */

export type MenuItem = Bilingual & {price: number};

/** Mock up 03: the menu board. Ink ground, cream text, warm grey English, reversed hairlines. */
export function MenuBoard({items, place, label, footnote}: {items: readonly MenuItem[]; place: string; label: Bilingual; footnote: string}) {
  return (
    <Field as="section" colour="ink" className={c.board} aria-label={`${label.bm} · ${label.en}`} data-cjt="menu-board">
      <div className={c.boardHead} data-cjt="menu-head">
        <BilingualLabel label={label} />
        <Label ink="secondary">{place}</Label>
      </div>
      <ul className={c.list}>
        {items.map((item) => (
          <li key={item.bm} className={c.boardItem} data-cjt="menu-item">
            <span className={c.boardName}>
              <Type role="subhead" lang="ms" className={c.boardItemName}>
                {item.bm}
              </Type>
              <Type role="caption" ink="secondary" className={c.boardSmall}>
                {item.en}
              </Type>
            </span>
            <Price amount={item.price} className={c.boardItemPrice} />
          </li>
        ))}
      </ul>
      <div className={c.boardFoot}>
        <PinkDot />
        <Type role="caption" lang="ms" className={c.boardSmall}>
          {footnote}
        </Type>
      </div>
    </Field>
  );
}
