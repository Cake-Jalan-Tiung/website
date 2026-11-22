import {useState, type ReactNode} from 'react';
import {Field} from './Field';
import type {Ground} from './model';
import type {space} from './tokens';
import {Type} from './Type';
import l from './layout.module.css';

type Gap = Exclude<keyof typeof space, '3xl'> | 'none';
type Align = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
type Justify = 'between' | 'center' | 'end';
type Landmark = {'aria-label'?: string; 'aria-labelledby'?: string};

/**
 * The page: full-width bands and gutter-held sheets, one under another. What comes
 * before and after the content (the awning and its bar, the sign-off) sits outside
 * <main>, so each keeps its own landmark.
 */
export function Page({top, bottom, children}: {top?: ReactNode; bottom?: ReactNode; children: ReactNode}) {
  return (
    <>
      {top}
      <main>{children}</main>
      {bottom}
    </>
  );
}

/** A run of sections on the Grammar sheet scaffold: 1440 sheet, 96 gutters, 128 between sections. */
export function Sheet({children}: {children: ReactNode}) {
  return <div className={l.sheet}>{children}</div>;
}

/**
 * One line of things that never stops passing: the bakes on the counter, a voice line.
 * The content is set twice so the loop has no seam; the second copy is hidden from
 * screen readers. It stops under the pointer, on a tap, and from the keyboard through
 * its own button. Under reduced motion it stands still and scrolls by hand.
 */
export function Marquee({gap = 'xl', children}: {gap?: Gap; children: ReactNode}) {
  const [paused, setPaused] = useState(false);
  const toggle = () => setPaused((was) => !was);
  return (
    <div className={l.marquee} data-gap={gap} data-paused={paused ? '' : undefined} data-fit="clips" onClick={toggle}>
      <button
        type="button"
        className={l.marqueePause}
        aria-pressed={paused}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
      >
        <Type role="label">{paused ? 'Play' : 'Pause'}</Type>
      </button>
      <div className={l.marqueeRun}>{children}</div>
      <div className={l.marqueeRun} aria-hidden>
        {children}
      </div>
    </div>
  );
}

/**
 * A bar of links over an ink rule: the nav under the awning, the index under a cover.
 * It stays at the top, on one line that scrolls sideways when the links outrun it.
 * It paints paper, so what it holds is set for paper wherever the bar sits.
 */
export function Bar({label, children}: {label: string; children: ReactNode}) {
  return (
    <Field as="nav" colour="paper" outlined={false} aria-label={label} className={l.bar} data-fit="scrolls">
      {children}
    </Field>
  );
}

/**
 * A full-width field of one ground, its content held to the sheet: the awning, a hero.
 * With `bleed` the content runs edge to edge. With `fill` the band takes the first
 * screen: its first child sits in the middle, its last at the foot. Paper needs no
 * band; it is the page.
 */
export function Band({
  ground,
  as,
  bleed = false,
  fill = false,
  children,
  ...landmark
}: {
  ground: Exclude<Ground, 'paper'>;
  as?: 'div' | 'section' | 'header' | 'footer';
  bleed?: boolean;
  fill?: boolean;
  children: ReactNode;
} & Landmark) {
  return (
    <Field {...landmark} as={as} colour={ground} className={l.band} data-bleed={bleed ? '' : undefined} data-fill={fill ? '' : undefined}>
      <div className={l.bandInner}>{children}</div>
    </Field>
  );
}

/** Things one under another, a brand spacing step apart. */
export function Stack({
  gap = 'lg',
  align,
  justify,
  as: As = 'div',
  children,
  ...landmark
}: {
  gap?: Gap;
  align?: Align;
  justify?: Justify;
  as?: 'div' | 'span' | 'section' | 'header' | 'footer' | 'nav' | 'address' | 'figure';
  children: ReactNode;
} & Landmark) {
  return (
    <As {...landmark} className={l.stack} data-gap={gap} data-align={align} data-justify={justify}>
      {children}
    </As>
  );
}

/** Things side by side that wrap when they run out of room. */
export function Row({gap = 'sm', align = 'center', justify, as: As = 'div', children, ...landmark}: {gap?: Gap; align?: Align; justify?: Justify; as?: 'div' | 'span' | 'nav' | 'footer'; children: ReactNode; 'aria-hidden'?: boolean} & Landmark) {
  return (
    <As {...landmark} className={l.row} data-gap={gap} data-align={align} data-justify={justify}>
      {children}
    </As>
  );
}

/** Equal columns. Seven become four and five become three under 1200px; under 900px all collapse to one, or to `narrow`. */
export function Columns({count, narrow = 1, gap = 'md', align, children}: {count: 2 | 3 | 5 | 7; narrow?: 1 | 2; gap?: Gap; align?: Align; children: ReactNode}) {
  return (
    <div className={l.columns} data-count={count} data-narrow={narrow} data-gap={gap} data-align={align}>
      {children}
    </div>
  );
}
