// How the palette reaches paper. Measurements come from print.generated.ts; the choices are here.
import {coatedCmyk} from './print.generated';

type Printing = {
  /** A mixed ink, for pieces printed in one or two colours. */
  spot?: string;
  /** The coated-stock CMYK build, for digital print, and how far it lands from the screen colour. */
  cmyk?: {cmyk: readonly number[]; deltaE: number};
  note?: string;
};

/** A spot ink's target as an ink mixer reads it: CIELAB D50, the screen colour. */
const labTarget = ([l, a, b]: readonly number[]) => `Mixed to Lab ${[l, a, b].map((v) => String(v).replace('-', '−')).join(' ')}`;

/**
 * Cobalt is the colour CMYK cannot hold (CIEDE2000 14 on coated stock), so a piece printed in
 * one or two colours carries it as a spot ink mixed to its Lab target and approved as a
 * drawdown on the real stock. CMYK is the fallback for digital work. Cream is a spot ink only
 * where it is printed onto something dark, as on the ribbon.
 * Pink is Pantone 2038 C, the nearest non-fluorescent match colorxs.com lists for #F75D9A
 * (ΔE 2.8 on screen). 812 C sits closer but is one of Pantone's neons, which fade in light.
 * Both are to be confirmed against a printed guide.
 */
export const printing = {
  ink: {cmyk: coatedCmyk.ink, note: 'Text in 100 K; the build is for large fields'},
  blue: {spot: labTarget(coatedCmyk.blue.lab), cmyk: coatedCmyk.blue},
  'cream-400': {spot: labTarget(coatedCmyk['cream-400'].lab), cmyk: coatedCmyk['cream-400'], note: 'On the box and the tote, the board or canvas itself'},
  pink: {spot: 'Pantone 2038 C', cmyk: coatedCmyk.pink},
  paper: {note: 'Unprinted stock'},
} as const satisfies Record<string, Printing>;

/** A colour's print specification as lines for a caption. */
export function printLines(p: Printing): string[] {
  return [
    p.spot ? `Spot · ${p.spot}` : null,
    p.cmyk ? `CMYK ${p.cmyk.cmyk.join(' ')} · ΔE ${p.cmyk.deltaE}` : null,
    p.note ?? null,
  ].filter((line): line is string => line !== null);
}
