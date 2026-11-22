import type {CSSProperties, ReactNode} from 'react';
import {
  BurungTiung,
  BurungTiungIcon,
  BurungTiungMono,
  BurungTiungReversed,
  PrimaryLockup,
  type MarkEntry,
  type MarkProps,
} from '../marks/marks.generated';
import {groundToken, hex, minSize, type Engine, type Flavour, type Ground, type GroundFor, type TextInk} from './model';
import {Type, type TypeRole} from './Type';
import c from './components.module.css';
import t from './type.module.css';

export type Bilingual = {bm: string; en: string};

/* ---------- Text patterns ---------- */

/** Small spaced capitals. Grammar sheet 04: only ever uppercase, only ever tracked. */
export function Label({children, ink = 'ink', as}: {children: ReactNode; ink?: TextInk | 'ink-muted'; as?: 'span' | 'p' | 'h2' | 'h3'}) {
  return (
    <Type role="label" ink={ink} as={as}>
      {children}
    </Type>
  );
}

/** Concept page masthead and statement; Grammar sheet scaffold. */
export function PageHeader({
  meta,
  aside,
  title,
  lede,
}: {
  meta: [string, string];
  aside?: string;
  title: string;
  lede?: ReactNode;
}) {
  return (
    <header className={c.pageHeader} data-cjt="page-header">
      <div className={c.metaRow}>
        <div className={c.metaStack}>
          <Label ink="muted">{meta[0]}</Label>
          <Label>{meta[1]}</Label>
        </div>
        {aside ? <Label ink="muted">{aside}</Label> : null}
      </div>
      <div className={c.statement}>
        <Type role="display" as="h1" className={c.title}>
          {title}
        </Type>
        {lede ? (
          <Type role="body" as="p" className={c.lede} data-cjt="lede">
            {lede}
          </Type>
        ) : null}
      </div>
    </header>
  );
}

/** The header every Paper section opens with: label, caption, a rule-in-a-phrase, a hairline. */
export function SectionHeader({
  label,
  caption,
  meta,
  rule = 'default',
  level = 2,
  id,
}: {
  label: string;
  caption?: string;
  meta?: string;
  rule?: 'default' | 'strong';
  level?: 2 | 3;
  id?: string;
}) {
  return (
    <div className={c.sectionHeader} data-rule={rule} data-cjt="section-header">
      <Label as={level === 2 ? 'h2' : 'h3'}>
        <span id={id}>{label}</span>
      </Label>
      {caption ? (
        <Type role="caption" ink="muted" className={c.sectionCaption}>
          {caption}
        </Type>
      ) : (
        <span className={c.sectionCaption} />
      )}
      {meta ? (
        <span className={c.sectionMeta}>
          <Label ink="muted">{meta}</Label>
        </span>
      ) : null}
    </div>
  );
}

/** Under every tile: an ink label, then a muted caption (Grammar scaffold). */
export function TileCaption({label, caption}: {label: string; caption?: ReactNode}) {
  return (
    <div className={c.tileCaption} data-cjt="tile-caption">
      <Label>{label}</Label>
      {caption ? <Type role="caption" ink="muted">{caption}</Type> : null}
    </div>
  );
}

/** Grammar sheet 15, form 01: the middot pair, for labels. Malay leads. */
export function BilingualLabel({label, onInk = false}: {label: Bilingual; onInk?: boolean}) {
  return (
    <Type role="label" ink={onInk ? 'cream' : 'ink'}>
      <span lang="ms">{label.bm}</span>
      <Type role="label" ink={onInk ? 'ink-muted' : 'muted'}>
        {' · '}
        {label.en}
      </Type>
    </Type>
  );
}

/** Grammar sheet 15, form 02: the stacked pair, the default for menus. */
export function StackedPair({label, role = 'subhead'}: {label: Bilingual; role?: Extract<TypeRole, 'subhead' | 'head'>}) {
  return (
    <span className={c.stacked}>
      <Type role={role} lang="ms">
        {label.bm}
      </Type>
      <Type role="caption" ink="muted">
        {label.en}
      </Type>
    </span>
  );
}

/** A bare numeral, as on the menu board. Screen readers hear the currency. */
export function Price({amount, ink = 'ink', role = 'subhead', className}: {amount: number; ink?: TextInk; role?: TypeRole; className?: string}) {
  return (
    <Type role={role} ink={ink} className={[c.price, className].filter(Boolean).join(' ')}>
      <span className={c.visuallyHidden}>RM </span>
      {amount}
    </Type>
  );
}

export function PinkDot({size = 9}: {size?: number}) {
  return <span aria-hidden className={c.dot} style={{width: size, height: size}} />;
}

export function Rule({tone = 'default'}: {tone?: 'default' | 'strong' | 'reversed'}) {
  return <hr className={c.rule} data-tone={tone} />;
}

/* ---------- Wordmarks and marks ---------- */

/** Grammar sheet 04: Jost Medium, capitals, 0.2em, cobalt. The fallback for the drawn lockup. */
export function TypesetWordmark({role = 'caption', onBlue = false}: {role?: Exclude<TypeRole, 'display'>; onBlue?: boolean}) {
  return (
    <Type role={role} ink={onBlue ? 'cream' : 'blue'} className={t.wordmark} data-cjt="wordmark">
      Cake Jalan Tiung
    </Type>
  );
}

const reversedSlots = {
  '--cjt-mark-blue': 'var(--cjt-color-cream)',
  '--cjt-mark-cream': 'var(--cjt-color-blue)',
} as CSSProperties;

/**
 * The primary lockup at a rendered width. Grammar sheet 04: below 180px the drawn
 * letters stop reading, so the typeset wordmark stands in. Never retyped above it.
 */
export function Logo({width, onBlue = false}: {width: number; onBlue?: boolean}) {
  if (width < minSize.drawnWordmark) return <TypesetWordmark onBlue={onBlue} />;
  return <PrimaryLockup width={width} style={{height: 'auto', maxWidth: '100%', ...(onBlue ? reversedSlots : null)}} />;
}

/**
 * Burung Tiung at a rendered size. Grammar sheet 14 and the Concept variants: at 32px
 * and under, the small-size icon (heavier lines, no feather texture) replaces it.
 * On ink it is the reversed drawing; for one-colour print, the mono drawing.
 */
export function Tiung({size, tone = 'default', ...rest}: {size: number; tone?: 'default' | 'reversed' | 'mono'} & Omit<MarkProps, 'width' | 'height'>) {
  if (size <= minSize.birdIcon) return <BurungTiungIcon width={size} height={size} {...rest} />;
  const Mark = tone === 'reversed' ? BurungTiungReversed : tone === 'mono' ? BurungTiungMono : BurungTiung;
  return <Mark width={size} height={size} {...rest} />;
}

/* ---------- Surfaces ---------- */

type StageProps<E extends Engine> = {
  /** What is drawn on it. Law 04: edible things may only sit on paper or cream-100. */
  engine: E;
  ground: GroundFor<E>;
  height?: number;
  padding?: number;
  outlined?: boolean;
  children: ReactNode;
};

/** A flat colour field a mark sits on. No border, no shadow, no radius. */
export function Stage<E extends Engine>({ground, height = 340, padding = 40, outlined, children}: StageProps<E>) {
  return (
    <div
      className={c.stage}
      data-outlined={outlined || ground === 'paper' ? '' : undefined}
      style={{background: groundToken[ground as Ground], '--stage-h': `${height}px`, '--stage-pad': `${padding}px`} as CSSProperties}
    >
      <div className={c.stageArt} style={{width: '100%', height: '100%'}}>
        {children}
      </div>
    </div>
  );
}

/** Stage plus caption, the unit every Paper sheet is built from. */
export function Tile<E extends Engine>({
  label,
  caption,
  ...stage
}: StageProps<E> & {label: string; caption?: ReactNode}) {
  return (
    <figure className={c.tile} style={{margin: 0}} data-cjt="tile">
      <Stage {...stage} />
      <figcaption>
        <TileCaption label={label} caption={caption} />
      </figcaption>
    </figure>
  );
}

/** A registry mark on the ground Paper shows it on. */
export function MarkTile({entry, height = 340}: {entry: MarkEntry; height?: number}) {
  const {Component} = entry;
  const art = <Component width="100%" height="100%" />;
  const caption = entry.note;
  if (entry.engine === 'edible') {
    return <Tile engine="edible" ground="cream-100" height={height} label={entry.label} caption={caption}>{art}</Tile>;
  }
  const ground: Ground = entry.name.endsWith('Reversed')
    ? 'ink'
    : entry.name.endsWith('Mono')
      ? 'chalk'
      : entry.name.endsWith('Icon')
        ? 'cream-400'
        : 'cream-100';
  return <Tile engine={entry.engine} ground={ground} height={height} label={entry.label} caption={caption}>{art}</Tile>;
}

/** Grammar example tiles: Correct on cream-100 with a cobalt tag, Never on chalk with a muted tag. */
export function Verdict({
  verdict,
  label,
  caption,
  height = 440,
  children,
}: {
  verdict: 'correct' | 'never';
  label: string;
  caption?: ReactNode;
  height?: number;
  children: ReactNode;
}) {
  const correct = verdict === 'correct';
  return (
    <figure className={c.tile} style={{margin: 0}}>
      <div className={c.stage} style={{background: groundToken[correct ? 'cream-100' : 'chalk'], '--stage-h': `${height}px`, '--stage-pad': '56px'} as CSSProperties}>
        <span className={c.verdictTag}>
          <Label ink={correct ? 'blue' : 'ink-60'}>{correct ? 'Correct' : 'Never'}</Label>
        </span>
        <div className={c.stageArt} style={{width: '100%', height: '100%'}}>
          {children}
        </div>
      </div>
      <figcaption>
        <TileCaption label={label} caption={caption} />
      </figcaption>
    </figure>
  );
}

/** Grammar sheet 06: one flavour per surface, as a ground; the identity stays cobalt and pink. */
export function FlavourCard({flavour, name, line}: {flavour: Flavour; name: Bilingual | string; line?: string}) {
  return (
    <article data-cjt="flavour-card" className={c.flavourCard} style={{background: groundToken[flavour]}}>
      <div className={c.flavourBrand}>
        <TypesetWordmark role="label" />
        <PinkDot />
      </div>
      <div className={c.flavourBody}>
        {typeof name === 'string' ? <Type role="subhead">{name}</Type> : <StackedPair label={name} />}
        {line ? <Type role="caption">{line}</Type> : null}
      </div>
    </article>
  );
}

/* ---------- Lists ---------- */

export type RuleEntry = {status: 'always' | 'never'; name: string; description: string};

/** Grammar sheet 02 "Custody": what is always and never done. */
export function RuleList({rules}: {rules: readonly RuleEntry[]}) {
  return (
    <ul className={c.ruleList}>
      {rules.map((r) => (
        <li key={r.name} className={c.ruleRow} data-cjt="rule-row">
          <span className={c.ruleStatus}>
            <Label ink={r.status === 'always' ? 'blue' : 'muted'}>{r.status === 'always' ? 'Always' : 'Never'}</Label>
          </span>
          <Type role="body" className={c.ruleName}>
            {r.name}
          </Type>
          <Type role="caption" ink="muted" className={c.ruleText}>
            {r.description}
          </Type>
        </li>
      ))}
    </ul>
  );
}

export type ColourRole = {colour: keyof typeof hex; name: string; source: string; description: string};

/** Grammar sheet 05 "Roles": each colour, its job, the physical object it came from. */
export function ColourRoles({roles}: {roles: readonly ColourRole[]}) {
  return (
    <ul className={c.ruleList}>
      {roles.map((r) => (
        <li key={r.name} className={c.roleRow} data-cjt="role-row">
          <span
            aria-hidden
            data-cjt="role-chip"
            className={c.roleChip}
            style={{background: hex[r.colour], boxShadow: r.colour === 'paper' ? 'inset 0 0 0 1px var(--cjt-color-rule)' : undefined}}
          />
          <span className={c.roleName}>
            <Label>{r.name}</Label>
            <Type role="caption" ink="muted">
              {hex[r.colour]}
            </Type>
          </span>
          <Type role="caption" className={c.roleSource}>
            {r.source}
          </Type>
          <Type role="caption" ink="muted" className={c.roleText}>
            {r.description}
          </Type>
        </li>
      ))}
    </ul>
  );
}

/** Concept "Our colours": a chip, its name, its value. */
export function Swatch({name, colour}: {name: string; colour: keyof typeof hex}) {
  return (
    <figure className={c.swatch} style={{margin: 0}} data-cjt="swatch">
      <span aria-hidden data-cjt="swatch-chip" className={c.swatchChip} data-outlined={colour === 'paper' ? '' : undefined} style={{background: hex[colour]}} />
      <figcaption className={c.swatchMeta}>
        <Label ink="muted">{name}</Label>
        <Type role="body">{hex[colour]}</Type>
      </figcaption>
    </figure>
  );
}

/* ---------- Menu ---------- */

export type MenuItem = {bm: string; en: string; price: number};

/** Mock up 03: the menu board. Ink ground, cream text, warm grey English, reversed hairlines. */
export function MenuBoard({items, place, label, footnote}: {items: readonly MenuItem[]; place: string; label: Bilingual; footnote: string}) {
  return (
    <section data-cjt="menu-board" className={c.board} aria-label={`${label.bm} · ${label.en}`}>
      <div className={c.boardHead} data-cjt="menu-head">
        <BilingualLabel label={label} onInk />
        <Label ink="ink-muted">{place}</Label>
      </div>
      <ul className={c.boardItems}>
        {items.map((item) => (
          <li key={item.bm} className={c.boardItem} data-cjt="menu-item">
            <span className={c.boardName}>
              <Type role="subhead" ink="cream" lang="ms" className={c.boardItemName}>
                {item.bm}
              </Type>
              <Type role="caption" ink="ink-muted" className={c.boardSmall}>
                {item.en}
              </Type>
            </span>
            <Price amount={item.price} ink="cream" className={c.boardItemPrice} />
          </li>
        ))}
      </ul>
      <div className={c.boardFoot}>
        <PinkDot />
        <Type role="caption" ink="cream" lang="ms" className={c.boardSmall}>
          {footnote}
        </Type>
      </div>
    </section>
  );
}
