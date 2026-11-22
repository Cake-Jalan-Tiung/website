import {createContext, useContext, type CSSProperties, type ReactNode} from 'react';
import {legalText, type Ground} from './model';
import {colorVar, type ColorName} from './tokens';
import f from './field.module.css';

const GroundContext = createContext<Ground>('paper');

/** The ground the nearest Field paints; the page itself is paper. */
export const useGround = () => useContext(GroundContext);

const isGround = (colour: ColorName): colour is Ground => colour in legalText;

type FieldProps = {
  colour: ColorName;
  as?: 'div' | 'span' | 'section' | 'article' | 'header' | 'footer';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  'aria-hidden'?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'data-cjt'?: string;
};

/**
 * A flat field of one brand colour: no border, no shadow, no radius (Grammar sheet 05).
 * Paper gets a hairline, or it would vanish on the page. Everything coloured is one of
 * these, and what sits inside can ask which ground it is on.
 */
export function Field({colour, as: As = 'div', className, style, children, ...rest}: FieldProps) {
  const field = (
    <As {...rest} className={className ? `${f.field} ${className}` : f.field} data-outlined={colour === 'paper' ? '' : undefined} style={{background: colorVar(colour), ...style}}>
      {children}
    </As>
  );
  return isGround(colour) ? <GroundContext value={colour}>{field}</GroundContext> : field;
}
