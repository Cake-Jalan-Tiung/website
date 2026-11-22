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
import {groundToken, hex, inkToken, legalText, type Ground} from '../system/model';
import {Type, type TypeRole} from '../system/Type';
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

const scale: ReadonlyArray<{role: TypeRole; name: string; spec: string; sample: string}> = [
  {role: 'display', name: 'Display', spec: '68 / 70 · Medium · −0.03em', sample: 'Baking the world'},
  {role: 'head', name: 'Head', spec: '40 / 42 · Medium · −0.03em', sample: 'Section openers'},
  {role: 'subhead', name: 'Subhead', spec: '24 / 28 · Regular', sample: 'Product names and prices'},
  {role: 'body', name: 'Body', spec: '15 / 24 · Regular · 520 max', sample: 'Sentences that a person actually reads.'},
  {role: 'caption', name: 'Caption', spec: '13 / 16 · Regular', sample: 'Descriptions under a label.'},
  {role: 'label', name: 'Label', spec: '11 / 14 · Regular · 0.18em caps', sample: 'Only ever uppercase'},
];

const vocabulary = [
  {bm: 'Hari ini', en: 'Today'},
  {bm: 'Baru keluar oven', en: 'Fresh from the oven'},
  {bm: 'Musim ini', en: 'In season'},
  {bm: 'Tempah sekarang', en: 'Order now'},
  {bm: 'Pesanan', en: 'Order'},
] as const;

const menu = [
  {bm: 'Roti Garam', en: 'Shio pan · salt roll, buttery centre', price: 8},
  {bm: 'Kek Pandan Kaya', en: 'Pandan kaya cake, coconut jam', price: 12},
  {bm: 'Teh Tarik', en: 'Pulled tea, condensed milk', price: 7},
] as const;

function Section({id, children}: {id: string; children: ReactNode}) {
  return (
    <section className={s.section} aria-labelledby={id}>
      {children}
    </section>
  );
}

function Marks({family}: {family: MarkFamily}) {
  return (
    <div className={s.triple}>
      {marks
        .filter((m) => m.family === family)
        .map((m) => (
          <MarkTile key={m.name} entry={m} />
        ))}
    </div>
  );
}

function GroundSample({ground}: {ground: Ground}) {
  const inks = legalText[ground];
  return (
    <figure className={s.groundTile} style={{background: groundToken[ground], margin: 0}} data-outlined={ground === 'paper' ? '' : undefined}>
      <div className={s.groundInks}>
        {inks.map((ink) => (
          <span key={ink} className={s.groundInk} style={{color: inkToken[ink]}}>
            Aa <span className={s.groundInkName}>{ink}</span>
          </span>
        ))}
      </div>
      <figcaption>
        <Label ink={ground === 'ink' ? 'cream' : 'ink'}>{ground}</Label>
      </figcaption>
    </figure>
  );
}

export function DesignSystem() {
  const [email, setEmail] = useState('');
  return (
    <main className={s.sheet}>
      <PageHeader
        meta={['Cake Jalan Tiung', 'Design system']}
        aside="Astryx · cjt theme"
        title={'Baking the world\na little sweeter.'}
        lede="Every component here is measured from the Paper file — Concept, Grammar and Mock up — and built on Astryx. Where Paper disagrees with itself, Grammar wins."
      />

      <Section id="logo">
        <SectionHeader id="logo" label="01 · Logo" caption="Drawn above 180px, typeset below. Never retyped." meta="Threshold · 180px wide" />
        <div className={s.pair}>
          <Tile engine="lettering" ground="cream-100" height={440} label="Drawn · 180px and up" caption="Shopfront, packaging, hero.">
            <Logo width={480} />
          </Tile>
          <Tile engine="lettering" ground="cream-400" height={440} label="Typeset · under 180px" caption="Receipts, stickers, app headers. Jost Medium, caps, 0.2em.">
            <Logo width={160} />
          </Tile>
        </div>
        <div className={s.blueBand}>
          <Logo width={360} onBlue />
        </div>
        <RuleList rules={custody} />
      </Section>

      <Section id="bird">
        <SectionHeader id="bird" label="02 · Burung Tiung" caption="One component. The icon takes over at 32px and under." meta="320 · 96 · 32 · 16" />
        <div className={s.sizes}>
          {[320, 96, 32, 16].map((size) => (
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
        <div className={s.pair}>
          <Verdict verdict="correct" label="On cream 100" caption="The fill reads against a lighter ground.">
            <ShioPan width="100%" height="100%" />
          </Verdict>
          <Verdict verdict="never" label="On cream 400" caption="The interior disappears and the drawing collapses. Stage refuses this at the type level.">
            <span className={s.illegal} style={{background: hex['cream-400']}}>
              <ShioPan width="100%" height="100%" />
            </span>
          </Verdict>
        </div>
      </Section>

      <Section id="colour">
        <SectionHeader id="colour" label="04 · Colour" caption="Every colour has one job and a physical object it came from." meta="Assigned by role" />
        <div className={s.five}>
          <Swatch name="Cocoa" colour="ink" />
          <Swatch name="Blueberry" colour="blue" />
          <Swatch name="Buttercream" colour="cream" />
          <Swatch name="Strawberry" colour="pink" />
          <Swatch name="Sugar" colour="paper" />
        </div>
        <ColourRoles roles={roles} />
        <SectionHeader id="grounds" level={3} label="Legal grounds" caption="What may sit on what, for body text. Generated from the pairing table, tested at 4.5:1." meta="WCAG AA" />
        <div className={s.grounds}>
          {(Object.keys(legalText) as Ground[]).map((g) => (
            <GroundSample key={g} ground={g} />
          ))}
        </div>
        <SectionHeader id="flavours" level={3} label="Flavours" caption="One per product family, one per surface. Ink text, cobalt wordmark." meta="Never two on one surface" />
        <div className={s.five}>
          <FlavourCard flavour="pandan" name="Pandan Kaya" line="Ink 11.4:1 · cobalt 4.9:1" />
          <FlavourCard flavour="gula" name="Gula Melaka" line="Ink 11.8:1 · cobalt 5.0:1" />
          <FlavourCard flavour="ais" name="Ais Cendol" line="Ink 11.4:1 · cobalt 4.9:1" />
          <FlavourCard flavour="ube" name="Ube Roll" line="Ink 11.0:1 · cobalt 4.7:1" />
          <FlavourCard flavour="teh" name="Teh Tarik" line="Ink 10.6:1 · cobalt 4.55:1" />
        </div>
      </Section>

      <Section id="type">
        <SectionHeader id="type" label="05 · Type" caption="Jost is the support face. Six steps, two weights." meta="11 · 13 · 15 · 24 · 40 · 68" />
        <ul className={s.scale}>
          {scale.map((step) => (
            <li key={step.role} className={s.scaleRow}>
              <span className={s.scaleName}>
                <Label>{step.name}</Label>
              </span>
              <span className={s.scaleSpec}>
                <Type role="caption">{step.spec}</Type>
              </span>
              <span data-spec={`type-${step.role}`}>
                <Type role={step.role}>{step.sample}</Type>
              </span>
            </li>
          ))}
        </ul>
        <div className={s.pair}>
          <Tile engine="lettering" ground="cream-400" height={220} label="Typeset wordmark" caption="Any step of the scale. Cobalt on light grounds, cream on cobalt.">
            <span className={s.stack}>
              <TypesetWordmark role="label" />
              <TypesetWordmark role="caption" />
              <TypesetWordmark role="subhead" />
            </span>
          </Tile>
          <Tile engine="lettering" ground="paper" height={220} label="Price" caption="A bare numeral. Screen readers hear RM.">
            <Price amount={12} role="head" />
          </Tile>
        </div>
      </Section>

      <Section id="language">
        <SectionHeader id="language" label="06 · Two languages" caption="Malay first, English second. Never mixed inside a phrase." meta="Three forms" />
        <div className={s.triple}>
          <Tile engine="lettering" ground="paper" height={200} label="Middot pair" caption="For labels only.">
            <BilingualLabel label={{bm: 'Hari ini', en: 'Today'}} />
          </Tile>
          <Tile engine="lettering" ground="paper" height={200} label="Stacked pair" caption="The default for menus.">
            <StackedPair label={{bm: 'Roti Garam', en: 'Salt roll, buttery centre'}} />
          </Tile>
          <Tile engine="lettering" ground="paper" height={200} label="Solo BM" caption="Voice lines stand alone. Never translated.">
            <span className={s.inline}>
              <PinkDot />
              <Type role="caption" lang="ms">
                Habis bila habis
              </Type>
            </span>
          </Tile>
        </div>
        <ul className={s.vocab}>
          {vocabulary.map((v) => (
            <li key={v.bm}>
              <BilingualLabel label={v} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="menu">
        <SectionHeader id="menu" label="07 · Menu board" caption="Ink ground, cream names and prices, warm grey English, reversed hairlines." meta="Mock up 03" />
        <div className={s.boardWrap}>
          <MenuBoard items={menu} place="Jalan Tiung" label={{bm: 'Hari ini', en: 'Today'}} footnote="Habis bila habis" />
        </div>
      </Section>

      <Section id="astryx">
        <SectionHeader id="astryx" label="08 · Astryx components" caption="The library's own components wearing the cjt theme." meta="174 available" />
        <div className={s.inline}>
          <Button variant="primary" label="Tempah sekarang" />
          <Button variant="secondary" label="Pesanan" />
          <Button variant="ghost" label="Hari ini" />
        </div>
        <div className={s.form}>
          <TextInput type="email" width="100%" label="Email" description="One email on Friday mornings." placeholder="you@example.com" value={email} onChange={(value) => setEmail(value)} />
        </div>
        <div className={s.triple}>
          <Card>
            <Type role="subhead">Default card</Type>
          </Card>
          <Card variant="cream">
            <Type role="subhead">Cream card</Type>
          </Card>
          <Card variant="ink">
            <Type role="subhead" ink="paper">
              Ink card
            </Type>
          </Card>
        </div>
      </Section>

      <footer className={s.footer}>
        <Rule />
        <div className={s.footRow}>
          <TypesetWordmark role="label" />
          <Label ink="muted">With love, from our kitchen</Label>
        </div>
      </footer>
    </main>
  );
}
