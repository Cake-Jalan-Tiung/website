import {useState, type ReactNode} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {TextInput} from '@astryxdesign/core/TextInput';
import {marks, ShioPan, type MarkFamily} from '../marks/marks.generated';
import {
  BilingualLabel,
  ColourRoles,
  FlavourCard,
  Label,
  Logo,
  MarkTile,
  MenuBoard,
  PageHeader,
  PinkDot,
  Price,
  Rule,
  RuleList,
  SectionHeader,
  StackedPair,
  Swatch,
  Tile,
  Tiung,
  TypesetWordmark,
  Verdict,
  type ColourRole,
  type RuleEntry,
} from '../system/components';
import {Field} from '../system/Field';
import {Columns, Row, Sheet, Stack} from '../system/layout';
import {contrast, legalText, type Flavour, type Ground} from '../system/model';
import {color, layout, minSize, tracking, typeScale, type ColorName, type TypeRole} from '../system/tokens';
import {Type} from '../system/Type';
import {boardPlace, labels, menu, promise, signOff, soldOutLine} from '../site/content';
import s from './specimen.module.css';

const custody: readonly RuleEntry[] = [
  {status: 'always', name: 'Place the SVG', description: 'One file, scaled proportionally. Recolour by swapping the fill token — the paths never change.'},
  {status: 'always', name: 'Keep the wonk', description: 'The tilt on CAKE and the uneven spacing are the asset, not defects to clean up.'},
  {status: 'never', name: 'Retype it in any font', description: 'If the drawn artwork will not fit, use the typeset wordmark instead.'},
  {status: 'never', name: 'Stroke, outline or skew it', description: 'Scale proportionally or not at all.'},
  {status: 'never', name: 'Pull the cake out as a standalone icon', description: 'When a square mark is needed, use the crowned Tiung head.'},
];

const roles: readonly ColourRole[] = [
  {colour: 'blue', name: 'Blue', source: 'Artline marker', description: 'Every structural line, the wordmark, all link and button text.'},
  {colour: 'pink', name: 'Pink', source: 'Strawberry candle', description: 'Beak, song, candle, cherry, crumbs. Never text, never structure, never a background.'},
  {colour: 'ink', name: 'Ink', source: 'Cocoa', description: 'Body copy, headlines, reversed grounds. Text is ink — not blue.'},
  {colour: 'muted', name: 'Muted', source: 'Pencil under-drawing', description: 'Secondary labels and captions only, never the primary voice.'},
  {colour: 'cream-100', name: 'Cream 100', source: 'Steam over the tray', description: 'Illustration stages and hero grounds.'},
  {colour: 'cream-200', name: 'Cream 200', source: 'The cut face of a cake', description: 'Interior fill inside a cobalt contour, and nothing else.'},
  {colour: 'cream-400', name: 'Cream 400', source: 'Kraft sleeve', description: 'Tiles, swatches, packaging fields.'},
];

const samples: Record<TypeRole, string> = {
  display: 'Baking the world',
  head: 'Section openers',
  subhead: 'Product names and prices',
  body: 'Sentences that a person actually reads.',
  caption: 'Descriptions under a label.',
  label: 'Only ever uppercase',
};

const capitalise = (word: string) => word[0].toUpperCase() + word.slice(1);

/** A step's numbers as the Grammar sheet prints them, e.g. "68 / 70 · Medium · −0.03em". */
function stepSpec(role: TypeRole): string {
  const step = typeScale[role];
  return [
    `${step.size} / ${step.leading}`,
    capitalise(step.weight),
    step.tracking ? `${String(tracking[step.tracking]).replace('-', '−')}em${step.caps ? ' caps' : ''}` : null,
    role === 'body' ? `${layout.measure} max` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

const scaleRoles = (Object.keys(typeScale) as TypeRole[]).reverse();
const birdSizes = [320, 96, minSize['bird-icon'], 16];
const drawnFrom = minSize['wordmark-drawn'];

// Sheet 06 names one product family per flavour.
const flavours: Record<Flavour, string> = {
  pandan: 'Pandan Kaya',
  gula: 'Gula Melaka',
  ais: 'Ais Cendol',
  ube: 'Ube Roll',
  teh: 'Teh Tarik',
};

const ratio = (ink: ColorName, ground: ColorName) => `${contrast(color[ink], color[ground]).toFixed(2)}:1`;

function Section({id, children}: {id: string; children: ReactNode}) {
  return (
    <Stack as="section" aria-labelledby={id}>
      {children}
    </Stack>
  );
}

function Marks({family}: {family: MarkFamily}) {
  return (
    <Columns count={3}>
      {marks
        .filter((m) => m.family === family)
        .map((m) => (
          <MarkTile key={m.name} entry={m} />
        ))}
    </Columns>
  );
}

function GroundSample({ground}: {ground: Ground}) {
  const inks = legalText[ground];
  return (
    <Field colour={ground} className={s.groundTile}>
      <div className={s.groundInks}>
        {inks.map((ink) => (
          <Type key={ink} role="body" ink={ink}>
            Aa <span className={s.groundInkName}>{ink}</span>
          </Type>
        ))}
      </div>
      <Label>{ground}</Label>
    </Field>
  );
}

export function DesignSystem() {
  const [email, setEmail] = useState('');
  return (
    <Sheet>
      <PageHeader
        meta={['Cake Jalan Tiung', 'Design system']}
        aside="Astryx · cjt theme"
        title={promise}
        lede="Every component here is measured from the Paper file — Concept, Grammar and Mock up — and built on Astryx. Where Paper disagrees with itself, Grammar wins."
      />

      <Section id="logo">
        <SectionHeader id="logo" label="01 · Logo" caption={`Drawn above ${drawnFrom}px, typeset below. Never retyped.`} meta={`Threshold · ${drawnFrom}px wide`} />
        <Columns count={2}>
          <Tile engine="lettering" ground="cream-100" height={440} label={`Drawn · ${drawnFrom}px and up`} caption="Shopfront, packaging, hero.">
            <Logo width={480} />
          </Tile>
          <Tile engine="lettering" ground="cream-400" height={440} label={`Typeset · under ${drawnFrom}px`} caption="Receipts, stickers, app headers. Jost Medium, caps, 0.2em.">
            <Logo width={160} />
          </Tile>
        </Columns>
        <Field colour="blue" className={s.blueBand}>
          <Logo width={360} />
        </Field>
        <RuleList rules={custody} />
      </Section>

      <Section id="bird">
        <SectionHeader id="bird" label="02 · Burung Tiung" caption={`One component. The icon takes over at ${minSize['bird-icon']}px and under.`} meta={birdSizes.join(' · ')} />
        <div className={s.sizes}>
          {birdSizes.map((size) => (
            <figure key={size} className={s.sizeStep}>
              <div className={s.sizeArt}>
                <Tiung size={size} aria-label={`Burung Tiung at ${size}px`} />
              </div>
              <figcaption>
                <Label ink="muted">{size}px</Label>
              </figcaption>
            </figure>
          ))}
        </div>
        <Marks family="tiung" />
        <SectionHeader id="crowned" level={3} label="Crowned Tiung" caption="The square mark. The head in profile, wearing a cake for a crown." />
        <Marks family="crowned" />
        <SectionHeader id="logos" level={3} label="Lockups and mascot" caption="For tiny spaces and profile pics." />
        <Marks family="logo" />
      </Section>

      <Section id="objects">
        <SectionHeader id="objects" label="03 · Objects" caption="Edible things are offset fills. They sit on paper or cream-100, never cream-400." meta="Six, and no more" />
        <Marks family="pastry" />
        <Marks family="drink" />
        <Columns count={2}>
          <Verdict verdict="correct" label="On cream 100" caption="The fill reads against a lighter ground.">
            <ShioPan width="100%" height="100%" />
          </Verdict>
          <Verdict verdict="never" label="On cream 400" caption="The interior disappears and the drawing collapses. Stage refuses this at the type level.">
            <Field as="span" colour="cream-400" className={s.illegal}>
              <ShioPan width="100%" height="100%" />
            </Field>
          </Verdict>
        </Columns>
      </Section>

      <Section id="colour">
        <SectionHeader id="colour" label="04 · Colour" caption="Every colour has one job and a physical object it came from." meta="Assigned by role" />
        <Columns count={5} narrow={2}>
          <Swatch name="Cocoa" colour="ink" />
          <Swatch name="Blueberry" colour="blue" />
          <Swatch name="Buttercream" colour="cream-400" />
          <Swatch name="Strawberry" colour="pink" />
          <Swatch name="Sugar" colour="paper" />
        </Columns>
        <ColourRoles roles={roles} />
        <SectionHeader id="grounds" level={3} label="Legal grounds" caption="What may sit on what, for body text. Generated from the pairing table, tested at 4.5:1." meta="WCAG AA" />
        <div className={s.grounds}>
          {(Object.keys(legalText) as Ground[]).map((g) => (
            <GroundSample key={g} ground={g} />
          ))}
        </div>
        <SectionHeader id="flavours" level={3} label="Flavours" caption="One per product family, one per surface. Ink text, cobalt wordmark." meta="Never two on one surface" />
        <Columns count={5} narrow={2}>
          {(Object.keys(flavours) as Flavour[]).map((flavour) => (
            <FlavourCard key={flavour} flavour={flavour} name={flavours[flavour]} line={`Ink ${ratio('ink', flavour)} · cobalt ${ratio('blue', flavour)}`} />
          ))}
        </Columns>
      </Section>

      <Section id="type">
        <SectionHeader id="type" label="05 · Type" caption="Jost is the support face. Six steps, two weights." meta={Object.values(typeScale).map((step) => step.size).join(' · ')} />
        <ul className={s.scale}>
          {scaleRoles.map((role) => (
            <li key={role} className={s.scaleRow}>
              <span className={s.scaleName}>
                <Label>{role}</Label>
              </span>
              <span className={s.scaleSpec}>
                <Type role="caption">{stepSpec(role)}</Type>
              </span>
              <span data-spec={`type-${role}`}>
                <Type role={role}>{samples[role]}</Type>
              </span>
            </li>
          ))}
        </ul>
        <Columns count={2}>
          <Tile engine="lettering" ground="cream-400" height={220} label="Typeset wordmark" caption="Any step of the scale. Cobalt on light grounds, cream on cobalt.">
            <Stack as="span" gap="sm" align="center">
              <TypesetWordmark role="label" />
              <TypesetWordmark role="caption" />
              <TypesetWordmark role="subhead" />
            </Stack>
          </Tile>
          <Tile engine="lettering" ground="paper" height={220} label="Price" caption="A bare numeral. Screen readers hear RM.">
            <Price amount={12} role="head" />
          </Tile>
        </Columns>
      </Section>

      <Section id="language">
        <SectionHeader id="language" label="06 · Two languages" caption="Malay first, English second. Never mixed inside a phrase." meta="Three forms" />
        <Columns count={3}>
          <Tile engine="lettering" ground="paper" height={200} label="Middot pair" caption="For labels only.">
            <BilingualLabel label={labels.today} />
          </Tile>
          <Tile engine="lettering" ground="paper" height={200} label="Stacked pair" caption="The default for menus.">
            <StackedPair label={menu[0]} />
          </Tile>
          <Tile engine="lettering" ground="paper" height={200} label="Solo BM" caption="Voice lines stand alone. Never translated.">
            <Row as="span">
              <PinkDot />
              <Type role="caption" lang="ms">
                {soldOutLine}
              </Type>
            </Row>
          </Tile>
        </Columns>
        <ul className={s.vocab}>
          {Object.values(labels).map((label) => (
            <li key={label.bm}>
              <BilingualLabel label={label} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="menu">
        <SectionHeader id="menu" label="07 · Menu board" caption="Ink ground, cream names and prices, warm grey English, reversed hairlines." meta="Mock up 03" />
        <div className={s.boardWrap}>
          <MenuBoard items={menu.slice(0, 3)} place={boardPlace} label={labels.today} footnote={soldOutLine} />
        </div>
      </Section>

      <Section id="astryx">
        <SectionHeader id="astryx" label="08 · Astryx components" caption="The library's own components wearing the cjt theme. Colour fields are Field, not Card." meta="174 available" />
        <Row>
          <Button variant="primary" label="Tempah sekarang" />
          <Button variant="secondary" label="Pesanan" />
          <Button variant="ghost" label="Hari ini" />
        </Row>
        <div className={s.form}>
          <TextInput type="email" width="100%" label="Email" description="One email on Friday mornings." placeholder="you@example.com" value={email} onChange={(value) => setEmail(value)} />
        </div>
        <div className={s.form}>
          <Card>
            <Type role="subhead">Card</Type>
          </Card>
        </div>
      </Section>

      <Stack as="footer" gap="md">
        <Rule />
        <Row justify="between" align="baseline">
          <TypesetWordmark role="label" />
          <Label ink="muted">{signOff}</Label>
        </Row>
      </Stack>
    </Sheet>
  );
}
