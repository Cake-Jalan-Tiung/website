import type {ReactNode} from 'react';
import {Link} from '@astryxdesign/core/Link';
import {BurungTiung, marks, TiungCat} from '../marks/marks.generated';
import {Label, Logo, MarkTile, MenuBoard, PinkDot, Price, Rule, SectionHeader, StackedPair, Stage, Statement, TypesetWordmark, VisuallyHidden} from '../system/components';
import {Band, Bar, Columns, Marquee, Page, Row, Sheet, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {Closing} from './Closing';
import {address, boardPlace, handDrawn, hours, inSeason, labels, menu, promise, soldOutLine, type Bilingual} from './content';

const sections = {today: 'hari-ini', inSeason: 'musim-ini', open: 'buka'} as const;
const bakes = marks.filter((mark) => mark.family === 'pastry' || mark.family === 'drink');

/** A site section: an ink rule, then the stacked pair as its heading. */
function Section({id, label, children}: {id: string; label: Bilingual; children: ReactNode}) {
  return (
    <Stack as="section" aria-labelledby={id}>
      <Stack gap="md">
        <Rule tone="marker" />
        <StackedPair label={label} role="head" as="h2" id={id} />
      </Stack>
      {children}
    </Stack>
  );
}

function Nav() {
  return (
    <Bar label="Sections">
      {(Object.keys(sections) as Array<keyof typeof sections>).map((key) => (
        <Link key={key} href={`#${sections[key]}`}>
          <Label ink="blue">
            <span lang="ms">{labels[key].bm}</span> · {labels[key].en}
          </Label>
        </Link>
      ))}
    </Bar>
  );
}

export function Site() {
  return (
    <Page
      top={
        <>
          <Band as="header" ground="blue">
            <Row justify="center">
              <Logo width={360} />
            </Row>
          </Band>
          <Nav />
        </>
      }
      bottom={<Closing />}
    >
      <Band ground="cream-100">
        <Columns count={2} align="center">
          <Statement title={promise} lede={handDrawn} />
          <Stage engine="alive" ground="cream-100" height={560} padding={0} mark={BurungTiung} />
        </Columns>
      </Band>
      <Sheet>
        <Section id={sections.today} label={labels.today}>
          <Columns count={2} align="start">
            <MenuBoard items={menu} place={boardPlace} label={labels.today} footnote={soldOutLine} />
            <Stack gap="md">
              <SectionHeader level={3} lang="ms" label={labels.freshFromOven.bm} caption={labels.freshFromOven.en} />
              <Columns count={2} narrow={2}>
                {bakes.map((mark) => (
                  <MarkTile key={mark.name} entry={mark} height={200} padding={24} />
                ))}
              </Columns>
            </Stack>
          </Columns>
        </Section>

      </Sheet>

      <Band ground="ink" bleed>
        <Marquee>
          {[0, 1, 2, 3].map((repeat) => (
            <Row key={repeat} as="span" gap="xl" aria-hidden={repeat > 0}>
              <Type role="display" lang="ms">
                {soldOutLine}
              </Type>
              <PinkDot />
            </Row>
          ))}
        </Marquee>
      </Band>

      <Band as="section" ground={inSeason.flavour} aria-labelledby={sections.inSeason}>
        <Stack gap="2xl">
          <Row justify="between" align="start" gap="md">
            <StackedPair label={labels.inSeason} role="head" as="h2" id={sections.inSeason} />
            <Row gap="xs">
              <TypesetWordmark role="label" />
              <PinkDot />
            </Row>
          </Row>
          <Row justify="between" align="end" gap="md">
            <Stack gap="xs">
              <Type role="display" as="p" lang="ms">
                {inSeason.item.bm}
              </Type>
              <Type role="body" as="p">
                {inSeason.item.en}
              </Type>
            </Stack>
            <Price amount={inSeason.item.price} role="display" />
          </Row>
        </Stack>
      </Band>

      <Band as="section" ground="cream-400" aria-labelledby={sections.open}>
        <Columns count={2} align="end">
          <Stack gap="xl">
            <StackedPair label={labels.open} role="head" as="h2" id={sections.open} />
            <Stack gap="xs">
              <Type role="display" as="p" aria-hidden>
                {hours.opens} – {hours.closes}
              </Type>
              <Type role="body" as="p" ink="secondary">
                <span aria-hidden>{hours.written}</span>
                <VisuallyHidden>{hours.spoken}</VisuallyHidden>
              </Type>
            </Stack>
            <Stack as="address" gap="xs">
              <Label ink="secondary">{address.name}</Label>
              <Stack gap="none">
                {address.lines.map((line) => (
                  <Type key={line} role="body">
                    {line}
                  </Type>
                ))}
              </Stack>
            </Stack>
          </Stack>
          <Stage engine="alive" ground="cream-400" height={440} padding={0} mark={TiungCat} />
        </Columns>
      </Band>
    </Page>
  );
}
