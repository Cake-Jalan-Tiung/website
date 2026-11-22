import type {ElementType, ReactNode} from 'react';
import type {TextInk} from './model';
import t from './type.module.css';

export type TypeRole = 'label' | 'caption' | 'body' | 'subhead' | 'head' | 'display';

const inkClass: Record<TextInk | 'ink-muted', string> = {
  ink: t.ink,
  muted: t.muted,
  blue: t.blue,
  paper: t.paper,
  cream: t.cream,
  pink: t.pink,
  'ink-60': t['ink-60'],
  'ink-muted': t.inkMuted,
};

/** Brand type: one of the six Grammar sheet 04 steps, in one of the legal inks. */
export function Type({
  role,
  ink = 'ink',
  as: As = 'span',
  className,
  children,
  id,
  lang,
  'data-cjt': dataCjt,
}: {
  role: TypeRole;
  ink?: TextInk | 'ink-muted';
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
  lang?: string;
  'data-cjt'?: string;
}) {
  return (
    <As id={id} lang={lang} data-cjt={dataCjt} className={[t[role], inkClass[ink], t.reset, className].filter(Boolean).join(' ')}>
      {children}
    </As>
  );
}
