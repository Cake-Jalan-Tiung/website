import type {ElementType, ReactNode} from 'react';
import {useGround} from './Field';
import {forbiddenText, legalText, type TextInk} from './model';
import type {TypeRole} from './tokens';
import t from './type.module.css';

export type {TypeRole};

export type TypeProps = {
  role: TypeRole;
  /** Defaults to the primary voice of the ground it sits on. */
  ink?: TextInk;
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
  lang?: string;
  'aria-hidden'?: boolean;
  'data-cjt'?: string;
};

/** Brand type: one of the six Grammar sheet 04 steps, in an ink that is legal on its ground. */
export function Type({role, ink, as: As = 'span', className, children, ...rest}: TypeProps) {
  const ground = useGround();
  const legal: readonly TextInk[] = legalText[ground];
  const set = ink ?? legal[0];
  if (import.meta.env.DEV && !legal.includes(set)) {
    const known = forbiddenText.find((pair) => pair.ink === set && pair.ground === ground);
    console.error(`cjt: ${set} text is not legal on ${ground}. ${known?.reason ?? `Use one of: ${legal.join(', ')}.`}`);
  }
  return (
    <As {...rest} className={[t[role], t[set], className].filter(Boolean).join(' ')}>
      {children}
    </As>
  );
}
