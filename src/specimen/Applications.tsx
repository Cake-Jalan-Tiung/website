import type {ReactNode} from 'react';
import {Croissant, CrownedTiung} from '../marks/marks.generated';
import {Artboard, ArtboardTile, BilingualLabel, Label, Logo, PinkDot, Price, SectionHeader, StackedPair, Stage, Tiung, TypesetWordmark, type ArtboardProps} from '../system/components';
import {Field} from '../system/Field';
import {Columns, Row, Stack} from '../system/layout';
import {coatedCmyk} from '../system/print.generated';
import {Type} from '../system/Type';
import {address, inSeason, labels, menu, signOff, soldOutLine} from '../site/content';
import s from './applications.module.css';

/** A social piece is drawn at the width a phone shows it and posted at this many times it. */
export const postedScale = 3;
/**
 * An 80mm receipt printer prints 576 dots across 72mm. The header is drawn 272px wide, 72mm to
 * within 0.03mm, so every dimension is a whole number of pixels at both sizes.
 */
const thermalScale = 576 / 272;

/** CSS px are 1/96 inch, so a print piece drawn in mm is at true scale and the six steps print at 0.75pt per px. */
const px = (mm: number) => (mm * 96) / 25.4;

/** Where a piece ends up: print at its real size in mm, or screen at the size the platform takes. */
type Format =
  | {medium: 'print'; mm: readonly [number, number]; method: string; /** When the drawn board holds more than the piece. */ size?: string}
  | {medium: 'screen'; posted: readonly [number, number]};

type Look = {ground: ArtboardProps['ground']; padding?: ArtboardProps['padding']; art: ReactNode};

type Piece = Look & {
  id: string;
  name: string;
  /** The rule the piece shows. */
  note: string;
  format: Format;
};

const drawn = (format: Format) => (format.medium === 'screen' ? {width: format.posted[0] / postedScale, height: format.posted[1] / postedScale} : {width: px(format.mm[0]), height: px(format.mm[1])});

const [rotiGaram, , gulaMelaka, croissant, , tehTarik] = menu;
const order = [rotiGaram, croissant, tehTarik];

const boxLid: Piece = {
  id: 'cake-box-lid',
  name: 'Cake box lid',
  note: 'The lockup’s cream is the board showing through. Nothing else goes on: text would have to be cobalt, and the bird’s beak is a second ink.',
  format: {medium: 'print', mm: [203, 203], method: 'An 8-inch cake box. Kraft board, cobalt as the one spot ink.'},
  ground: 'cream-400',
  padding: 'xl',
  art: (
    <Stack justify="center" align="center">
      <Logo width={px(150)} />
    </Stack>
  ),
};

const seal: Piece = {
  id: 'seal-sticker',
  name: 'Seal sticker',
  note: `The square mark is the crowned head, never the cake on its own. Cobalt prints duller in CMYK (ΔE ${coatedCmyk.blue.deltaE}).`,
  format: {medium: 'print', mm: [50, 50], method: 'White sticker paper, digital CMYK, die-cut square.'},
  ground: 'paper',
  padding: 'sm',
  art: (
    <Stack justify="center" align="center" gap="xs">
      <CrownedTiung width={px(26)} />
      <TypesetWordmark role="label" />
    </Stack>
  ),
};

const ribbon: Piece = {
  id: 'ribbon',
  name: 'Ribbon',
  note: 'On ink the wordmark turns cream. Pink is the one colour that crosses onto it.',
  format: {medium: 'print', mm: [200, 25], method: 'One-inch black satin, two spot inks: cream and pink.'},
  ground: 'ink',
  padding: ['xs', 'sm'],
  art: (
    <Row justify="between" gap="md">
      {[0, 1].map((repeat) => (
        <Row key={repeat} as="span" gap="xs" aria-hidden={repeat > 0}>
          <TypesetWordmark role="subhead" />
          <PinkDot />
        </Row>
      ))}
    </Row>
  ),
};

const post: Piece = {
  id: 'instagram-post',
  name: 'Instagram post',
  note: 'One flavour per post, and only words on it: a bake is drawn on cream.',
  format: {medium: 'screen', posted: [1080, 1350]},
  ground: inSeason.flavour,
  art: (
    <Stack justify="between">
      <Row justify="between" align="start" gap="md">
        <StackedPair label={labels.inSeason} />
        <Row gap="xs">
          <TypesetWordmark role="label" />
          <PinkDot />
        </Row>
      </Row>
      <Stack gap="sm">
        <Type role="display" as="p" lang="ms">
          {inSeason.item.bm}
        </Type>
        <Row justify="between" align="end" gap="md">
          <Type role="body" as="p">
            {inSeason.item.en}
          </Type>
          <Price amount={inSeason.item.price} role="head" />
        </Row>
      </Stack>
    </Stack>
  ),
};

// Third-party guides keep the top and bottom 250 of a story's 1920px clear of Instagram's
// own buttons: 83px at the drawn size, inside the 96px block padding.
const story: Piece = {
  id: 'instagram-story',
  name: 'Instagram story',
  note: 'Nothing in the top and bottom 250px, where Instagram puts its own buttons. The bake sits on cream-100.',
  format: {medium: 'screen', posted: [1080, 1920]},
  ground: 'cream-100',
  padding: ['2xl', 'md'],
  art: (
    <Stack justify="between" gap="md">
      <BilingualLabel label={labels.freshFromOven} />
      <Stage engine="edible" ground="cream-100" height={240} padding={0} mark={Croissant} />
      <Row justify="between" align="end" gap="md">
        <StackedPair label={croissant} role="head" />
        <Price amount={croissant.price} role="head" />
      </Row>
      <Row gap="xs">
        <PinkDot />
        <Type role="caption" lang="ms">
          {soldOutLine}
        </Type>
      </Row>
    </Stack>
  ),
};

const priceCard: Piece = {
  id: 'price-card',
  name: 'Price card',
  note: 'Malay over English and a bare numeral, as on the menu board.',
  format: {medium: 'print', mm: [90, 54], method: 'Name-card stock, digital CMYK.'},
  ground: 'paper',
  art: (
    <Stack justify="between">
      <Row gap="xs">
        <TypesetWordmark role="label" />
        <PinkDot />
      </Row>
      <Row justify="between" align="end" gap="md">
        <StackedPair label={gulaMelaka} />
        <Price amount={gulaMelaka.price} role="head" />
      </Row>
    </Stack>
  ),
};

// The part of the receipt the till prints as an image. Thermal paper has one ink, so nothing recedes into grey.
const receiptHeader = (
  <Stack gap="xs" align="start">
    <Tiung size={48} mono />
    <TypesetWordmark role="caption" mono />
    <Stack gap="none">
      {address.lines.map((line) => (
        <Type key={line} role="caption">
          {line}
        </Type>
      ))}
    </Stack>
  </Stack>
);

const receipt: Piece = {
  id: 'receipt',
  name: 'Receipt',
  note: 'One ink: the single-colour bird and the typeset wordmark, both in ink.',
  format: {medium: 'print', mm: [80, 100], size: '80 mm roll', method: 'An 80mm thermal roll. The header prints from a 576-dot image; the till sets the lines in its own font.'},
  ground: 'paper',
  padding: ['md', 'sm'],
  art: (
    <Stack gap="md">
      {receiptHeader}
      <Stack gap="xs">
        {order.map((item) => (
          <Row key={item.bm} justify="between" gap="sm">
            <Type role="caption" lang="ms">
              {item.bm}
            </Type>
            <Price amount={item.price} role="caption" />
          </Row>
        ))}
      </Stack>
      <Row justify="between" align="baseline" gap="sm">
        <Label>
          <span lang="ms">{labels.total.bm}</span> · {labels.total.en}
        </Label>
        <Price amount={order.reduce((sum, item) => sum + item.price, 0)} />
      </Row>
      <Type role="caption">{signOff}</Type>
    </Stack>
  ),
};

// The table shows through between the straps, so the board itself is the stage's chalk.
const tote: Piece = {
  id: 'tote-bag',
  name: 'Tote bag',
  note: 'The stacked lockup, for when we need to go tall. The ink carries the cobalt, not a dyed fabric.',
  format: {medium: 'print', mm: [380, 700], size: '380 × 420 mm', method: 'Natural cotton canvas, one-colour screen print, 280mm strap drop.'},
  ground: 'chalk',
  padding: 'none',
  art: (
    <Stack gap="none" align="center">
      <span className={s.straps} aria-hidden />
      <Field colour="cream-400" className={s.bag}>
        <Logo width={px(250)} stacked />
      </Field>
    </Stack>
  ),
};

const groups: ReadonlyArray<{id: string; label: string; caption: string; meta?: string; stage: number; pieces: readonly [Piece, Piece] | readonly [Piece, Piece, Piece]}> = [
  {id: 'packaging', label: 'Packaging', caption: 'Cobalt goes on as ink, onto kraft and white stock. The bakes stay on paper and cream.', meta: 'Drawn at real size', stage: 400, pieces: [boxLid, seal, ribbon]},
  {id: 'social', label: 'Social', caption: 'Drawn at the width a phone shows it, so the six steps hold.', meta: `Exports at ${postedScale}×`, stage: 560, pieces: [post, story]},
  {id: 'counter', label: 'At the counter', caption: 'What a customer holds after paying.', meta: 'Drawn at real size', stage: 440, pieces: [priceCard, receipt, tote]},
];

const pieces = groups.flatMap((group) => group.pieces);
export const pieceCount = pieces.length;

const sizeOf = (format: Format) => (format.medium === 'print' ? (format.size ?? `${format.mm.join(' × ')} mm`) : `${format.posted.join(' × ')} px`);
const captionOf = ({format, note}: Piece) => (format.medium === 'print' ? `${format.method} ${note}` : note);

/** The Applications chapter's body: each group under its header, each piece fitted to a tile. */
export function Applications() {
  return groups.map((group) => (
    <Stack key={group.id} as="section" aria-labelledby={`applications-${group.id}`}>
      <SectionHeader id={`applications-${group.id}`} level={3} label={group.label} caption={group.caption} meta={group.meta} />
      <Columns count={group.pieces.length} align="start">
        {group.pieces.map((piece) => (
          <ArtboardTile key={piece.id} label={`${piece.name} · ${sizeOf(piece.format)}`} caption={captionOf(piece)} stage={group.stage} ground={piece.ground} padding={piece.padding} {...drawn(piece.format)}>
            {piece.art}
          </ArtboardTile>
        ))}
      </Columns>
    </Stack>
  ));
}

/** A file `pnpm export` writes: drawn at posted / scale, photographed at scale. */
type Png = Look & {id: string; posted: readonly [number, number]; scale: number};

const pngs: readonly Png[] = [
  ...pieces.flatMap((piece) => (piece.format.medium === 'screen' ? [{...piece, posted: piece.format.posted, scale: postedScale}] : [])),
  {id: 'receipt-header', posted: [576, 360], scale: thermalScale, ground: 'paper', padding: 'xs', art: receiptHeader},
];

/** Every exported piece at its drawn size, for scripts/export.mjs to photograph. */
export function Exports() {
  return (
    <Stack gap="md">
      {pngs.map((png) => (
        <Artboard key={png.id} data-export={png.id} data-posted={png.posted.join('x')} data-scale={String(png.scale)} ground={png.ground} padding={png.padding} outlined={false} width={png.posted[0] / png.scale} height={png.posted[1] / png.scale}>
          {png.art}
        </Artboard>
      ))}
    </Stack>
  );
}
