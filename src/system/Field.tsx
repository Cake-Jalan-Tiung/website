import {createContext, useContext, type HTMLAttributes, type RefCallback} from 'react';
import {legalText, type Ground} from './model';
import {colorVar, type ColorName} from './tokens';
import f from './field.module.css';

const GroundContext = createContext<Ground>('paper');

/** The ground the nearest Field paints; the page itself is paper. */
export const useGround = () => useContext(GroundContext);

const isGround = (colour: ColorName): colour is Ground => colour in legalText;

type FieldProps = Omit<HTMLAttributes<HTMLElement>, 'color'> & {
  colour: ColorName;
  as?: 'div' | 'span' | 'section' | 'article' | 'header' | 'footer' | 'nav';
  /** Paper is outlined unless told otherwise, or it would vanish on the page. */
  outlined?: boolean;
  ref?: RefCallback<HTMLElement>;
};

/**
 * A flat field of one brand colour: no border, no shadow, no radius (Grammar sheet 05).
 * Everything that paints a colour is one of these, so what sits inside can ask which
 * ground it is on.
 */
export function Field({colour, as: As = 'div', outlined = colour === 'paper', className, style, children, ...rest}: FieldProps) {
  const field = (
    <As {...rest} className={className ? `${f.field} ${className}` : f.field} data-outlined={outlined ? '' : undefined} style={{background: colorVar(colour), ...style}}>
      {children}
    </As>
  );
  return isGround(colour) ? <GroundContext value={colour}>{field}</GroundContext> : field;
}
