import type {ReactNode} from 'react';
import {Field} from './Field';
import type {Ground} from './model';
import type {space} from './tokens';
import l from './layout.module.css';

type Gap = Exclude<keyof typeof space, '3xl'> | 'none';
type Align = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
type Justify = 'between' | 'center' | 'end';
type Landmark = {'aria-label'?: string; 'aria-labelledby'?: string};

/** A page on the Grammar sheet scaffold: 1440 sheet, 96 gutters, 128 between sections. */
export function Sheet({children}: {children: ReactNode}) {
  return <main className={l.sheet}>{children}</main>;
}

/** A full-width field of one ground, its content held to the sheet: the awning, a hero. Paper needs no band; it is the page. */
export function Band({ground, as, children, ...landmark}: {ground: Exclude<Ground, 'paper'>; as?: 'div' | 'section' | 'header' | 'footer'; children: ReactNode} & Landmark) {
  return (
    <Field {...landmark} as={as} colour={ground} className={l.band}>
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
export function Row({gap = 'sm', align = 'center', justify, as: As = 'div', children, ...landmark}: {gap?: Gap; align?: Align; justify?: Justify; as?: 'div' | 'span' | 'nav' | 'footer'; children: ReactNode} & Landmark) {
  return (
    <As {...landmark} className={l.row} data-gap={gap} data-align={align} data-justify={justify}>
      {children}
    </As>
  );
}

/** Equal columns. Under 900px they collapse to one, or to `narrow`. */
export function Columns({count, narrow = 1, gap = 'md', align, children}: {count: 2 | 3 | 5; narrow?: 1 | 2; gap?: Gap; align?: Align; children: ReactNode}) {
  return (
    <div className={l.columns} data-count={count} data-narrow={narrow} data-gap={gap} data-align={align}>
      {children}
    </div>
  );
}
