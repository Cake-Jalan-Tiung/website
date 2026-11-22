import {useState, type ReactNode} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Link} from '@astryxdesign/core/Link';
import {TextInput} from '@astryxdesign/core/TextInput';
import {BurungTiung, marks, ShioPan, type MarkFamily} from '../marks/marks.generated';
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
  Stage,
  Swatch,
  Tile,
  Tiung,
  TypesetWordmark,
  Verdict,
  type ColourRole,
  type RuleEntry,
} from '../system/components';
import {Field} from '../system/Field';
import {Band, Bar, Columns, Marquee, Page, Row, Sheet, Stack} from '../system/layout';
import {contrast, legalText, type Flavour, type Ground} from '../system/model';
import {color, layout, minSize, tracking, typeScale, type ColorName, type TypeRole} from '../system/tokens';
import {Type} from '../system/Type';
import {Closing} from '../site/Closing';
import {boardPlace, handDrawn, labels, menu, promise, signOff, soldOutLine} from '../site/content';
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

const bakes = marks.filter((mark) => mark.engine === 'edible');
const birdNote = marks.find((mark) => mark.name === 'BurungTiungFilled')?.note ?? '';

// The chapters, in order. The index bar and each opener read this.
const chapters = {
  logo: {title: 'Logo', line: `Drawn above ${drawnFrom}px, typeset below. Never retyped.`, meta: `Threshold · ${drawnFrom}px wide`},
  bird: {title: 'Burung Tiung', line: `${birdNote}. One component: the icon takes over at ${minSize['bird-icon']}px and under.`, meta: birdSizes.join(' · ')},
  objects: {title: 'Objects', line: 'Edible things are offset fills. They sit on paper or cream-100, never cream-400.', meta: 'Six, and no more'},
  colour: {title: 'Colour', line: 'Every colour has one job and a physical object it came from.', meta: 'Assigned by role'},
  type: {title: 'Type', line: 'Jost is the support face. Six steps, two weights.', meta: Object.values(typeScale).map((step) => step.size).join(' · ')},
  language: {title: 'Two languages', line: 'Malay first, English second. Never mixed inside a phrase.', meta: 'Three forms'},
  menu: {title: 'Menu board', line: 'Ink ground, cream names and prices, warm grey English, reversed hairlines.', meta: 'Mock up 03'},
  astryx: {title: 'Components', line: "Astryx's own components wearing the cjt theme. Colour fields are Field, not Card.", meta: '174 available'},
} as const;
type ChapterId = keyof typeof chapters;
const chapterIds = Object.keys(chapters) as ChapterId[];
const chapterNumber = (id: ChapterId) => String(chapterIds.indexOf(id) + 1).padStart(2, '0');

/** A chapter's opening: its number and title set large, the brand's own line beside it, or under it in half a band. */
function ChapterHead({id, stacked = false}: {id: ChapterId; stacked?: boolean}) {
  const {title, line, meta} = chapters[id];
  const heading = (
    <Stack gap="sm">
      <Label ink="secondary">{meta}</Label>
      <Type role="display" as="h2" id={id}>
        <Type role="display" ink="secondary" aria-hidden>
          {chapterNumber(id)}
        </Type>{' '}
        {title}
      </Type>
    </Stack>
  );
  const statement = (
    <Type role="subhead" as="p">
      {line}
    </Type>
  );
  return stacked ? (
    <Stack gap="md">
      {heading}
      {statement}
    </Stack>
  ) : (
    <Columns count={2} align="end">
      {heading}
      {statement}
    </Columns>
  );
}

function Chapter({id, children}: {id: ChapterId; children: ReactNode}) {
  return (
    <Stack as="section" gap="xl" aria-labelledby={id}>
      <Stack gap="md">
        <Rule tone="marker" />
        <ChapterHead id={id} />
      </Stack>
      <Stack>{children}</Stack>
    </Stack>
  );
}

function Marks({family, count = 3}: {family: MarkFamily; count?: 3 | 5}) {
  return (
    <Columns count={count} narrow={count === 5 ? 2 : 1}>
      {marks
        .filter((m) => m.family === family)
        .map((m) => (
          <MarkTile key={m.name} entry={m} height={count === 5 ? 280 : undefined} padding={count === 5 ? 24 : undefined} />
        ))}
    </Columns>
  );
}

function GroundSample({ground}: {ground: Ground}) {
  return (
    <Field colour={ground} className={s.groundTile}>
      <Stack gap="none">
        {legalText[ground].map((ink) => (
          <Type key={ink} role="body" ink={ink}>
            Aa <Type role="caption" ink={ink}>{ink}</Type>
          </Type>
        ))}
      </Stack>
      <Label>{ground}</Label>
    </Field>
  );
}

/** A ground at full width, named for the object it came from (Grammar sheet 05). */
function Origin({role}: {role: ColourRole & {colour: Exclude<Ground, 'paper'>}}) {
  return (
    <Band ground={role.colour}>
      <Columns count={2} align="end">
        <Type role="display" as="p">
          {role.source}
        </Type>
        <Stack gap="xs">
          <Label>
            {role.name} · {color[role.colour]}
          </Label>
          <Type role="body" as="p">
            {role.description}
          </Type>
        </Stack>
      </Columns>
    </Band>
  );
}

const isGroundRole = (role: ColourRole): role is ColourRole & {colour: Exclude<Ground, 'paper'>} => role.colour in legalText && role.colour !== 'paper';
// Darkest first, so the fields step down to the paper the page is printed on.
const groundRoles = roles.filter(isGroundRole).sort((a, b) => contrast(color[b.colour], color.paper) - contrast(color[a.colour], color.paper));
const accentRoles = roles.filter((role) => !isGroundRole(role));

export function DesignSystem() {
  const [email, setEmail] = useState('');
  return (
    <Page
      top={
        <>
          <Band as="header" ground="blue" fill>
            <Logo width={960} />
            <Row justify="between" align="baseline">
              <Label>Design system</Label>
              <Label>{signOff}</Label>
            </Row>
          </Band>
          <Bar label="Chapters">
            {chapterIds.map((id) => (
              <Link key={id} href={`#${id}`}>
                <Label ink="blue">
                  {chapterNumber(id)} {chapters[id].title}
                </Label>
              </Link>
            ))}
          </Bar>
        </>
      }
      bottom={<Closing />}
    >
      <Band ground="cream-100">
        <Columns count={2} align="center">
          <PageHeader meta={['Cake Jalan Tiung', 'Design system']} aside="Astryx · cjt theme" title={promise} lede={handDrawn} />
          <Stage engine="alive" ground="cream-100" height={560} padding={0} mark={BurungTiung} />
        </Columns>
      </Band>

      <Band ground="cream-100" bleed>
        <Marquee>
          {bakes.map((mark) => (
            <mark.Component key={mark.name} width={160} />
          ))}
        </Marquee>
      </Band>

      <Sheet>
        <Chapter id="logo">
          <Columns count={2}>
            <Tile engine="lettering" ground="cream-100" height={440} label={`Drawn · ${drawnFrom}px and up`} caption="Shopfront, packaging, hero.">
              <Logo width={480} />
            </Tile>
            <Tile engine="lettering" ground="cream-400" height={440} label={`Typeset · under ${drawnFrom}px`} caption="Receipts, stickers, app headers. Jost Medium, caps, 0.2em.">
              <Logo width={160} />
            </Tile>
          </Columns>
          <RuleList rules={custody} />
        </Chapter>

        <Chapter id="bird">
          <Row gap="xl" align="end">
            {birdSizes.map((size) => (
              <Stack key={size} as="figure" gap="sm" align="start">
                <Tiung size={size} aria-label={`Burung Tiung at ${size}px`} />
                <figcaption>
                  <Label ink="secondary">{size}px</Label>
                </figcaption>
              </Stack>
            ))}
          </Row>
          <Marks family="tiung" count={5} />
          <SectionHeader id="crowned" level={3} label="Crowned Tiung" caption="The square mark. The head in profile, wearing a cake for a crown." />
          <Marks family="crowned" />
          <SectionHeader id="logos" level={3} label="Lockups and mascot" caption="For tiny spaces and profile pics." />
          <Marks family="logo" />
        </Chapter>

        <Chapter id="objects">
          <Marks family="pastry" />
          <Marks family="drink" />
          <Columns count={2}>
            <Verdict verdict="correct" label="On cream 100" caption="The fill reads against a lighter ground." mark={ShioPan} />
            <Verdict verdict="never" label="On cream 400" caption="The interior disappears and the drawing collapses. Stage refuses this at the type level.">
              <Field as="span" colour="cream-400" className={s.illegal}>
                <ShioPan width="100%" height="100%" />
              </Field>
            </Verdict>
          </Columns>
        </Chapter>

        <Chapter id="colour">
          <Columns count={5} narrow={2}>
            <Swatch name="Cocoa" colour="ink" />
            <Swatch name="Blueberry" colour="blue" />
            <Swatch name="Buttercream" colour="cream-400" />
            <Swatch name="Strawberry" colour="pink" />
            <Swatch name="Sugar" colour="paper" />
          </Columns>
        </Chapter>
      </Sheet>

      {groundRoles.map((role) => (
        <Origin key={role.colour} role={role} />
      ))}

      <Sheet>
        <Stack as="section" aria-labelledby="accents">
          <SectionHeader id="accents" level={3} label="Never a ground" caption="Three colours that only ever sit on something else." />
          <ColourRoles roles={accentRoles} />
        </Stack>
        <Stack as="section" aria-labelledby="grounds">
          <SectionHeader id="grounds" level={3} label="Legal grounds" caption="What may sit on what, for body text. Generated from the pairing table, tested at 4.5:1." meta="WCAG AA" />
          <Columns count={7} narrow={2} gap="sm">
            {(Object.keys(legalText) as Ground[]).map((g) => (
              <GroundSample key={g} ground={g} />
            ))}
          </Columns>
        </Stack>
        <Stack as="section" aria-labelledby="flavours">
          <SectionHeader id="flavours" level={3} label="Flavours" caption="One per product family, one per surface. Ink text, cobalt wordmark." meta="Never two on one surface" />
          <Columns count={5} narrow={2} gap="none">
            {(Object.keys(flavours) as Flavour[]).map((flavour) => (
              <FlavourCard key={flavour} flavour={flavour} name={flavours[flavour]} line={`Ink ${ratio('ink', flavour)} · cobalt ${ratio('blue', flavour)}`} />
            ))}
          </Columns>
        </Stack>

        <Chapter id="type">
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
        </Chapter>

        <Chapter id="language">
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
        </Chapter>
      </Sheet>

      <Band as="section" ground="ink" aria-labelledby="menu">
        <Columns count={2} align="center">
          <Stack gap="xl">
            <ChapterHead id="menu" stacked />
            <Tiung size={240} />
          </Stack>
          <MenuBoard items={menu} place={boardPlace} label={labels.today} footnote={soldOutLine} />
        </Columns>
      </Band>

      <Sheet>
        <Chapter id="astryx">
          <Row>
            <Button variant="primary" label={labels.orderNow.bm} />
            <Button variant="secondary" label={labels.order.bm} />
            <Button variant="ghost" label={labels.today.bm} />
          </Row>
          <Row>
            <Button variant="primary" label={labels.orderNow.bm} isDisabled />
            <Button variant="secondary" label={labels.order.bm} isDisabled />
            <Button variant="ghost" label={labels.today.bm} isDisabled />
          </Row>
          <Columns count={3} align="start">
            <TextInput type="email" width="100%" label="Email" description="One email on Friday mornings." placeholder="you@example.com" value={email} onChange={(value) => setEmail(value)} />
            <Card>
              <Type role="subhead">Card</Type>
            </Card>
          </Columns>
        </Chapter>
      </Sheet>
    </Page>
  );
}
