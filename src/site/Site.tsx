import type {ReactNode} from 'react';
import {Link} from '@astryxdesign/core/Link';
import {BurungTiung, marks, TiungCat} from '../marks/marks.generated';
import {FlavourCard, Label, Logo, MarkTile, MenuBoard, Rule, SectionHeader, StackedPair, Stage, Statement, VisuallyHidden} from '../system/components';
import {Band, Columns, Row, Sheet, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {address, boardPlace, handDrawn, hours, inSeason, labels, menu, promise, signOff, soldOutLine, type Bilingual} from './content';
import s from './site.module.css';

const sections = {today: 'hari-ini', inSeason: 'musim-ini', open: 'buka'} as const;
const bakes = marks.filter((mark) => mark.family === 'pastry' || mark.family === 'drink');

/** A site section: an ink rule, then the stacked pair as its heading. */
function Section({id, label, children}: {id: string; label: Bilingual; children: ReactNode}) {
  return (
    <Stack as="section" aria-labelledby={id}>
      <Stack gap="md">
        <Rule tone="strong" />
        <StackedPair label={label} role="head" as="h2" id={id} />
      </Stack>
      {children}
    </Stack>
  );
}

function Nav() {
  return (
    <nav aria-label="Sections" className={s.nav}>
      <Row justify="center" gap="md">
        {(Object.keys(sections) as Array<keyof typeof sections>).map((key) => (
          <Link key={key} href={`#${sections[key]}`}>
            <Label ink="blue">
              <span lang="ms">{labels[key].bm}</span> · {labels[key].en}
            </Label>
          </Link>
        ))}
      </Row>
    </nav>
  );
}

export function Site() {
  return (
    <>
      <Band as="header" ground="blue">
        <Row justify="center">
          <Logo width={360} />
        </Row>
      </Band>
      <Nav />
      <Band ground="cream-100">
        <Columns count={2} align="center">
          <Statement title={promise} lede={handDrawn} />
          <Stage engine="alive" ground="cream-100" height={560} padding={0}>
            <BurungTiung width="100%" height="100%" />
          </Stage>
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

        <Section id={sections.inSeason} label={labels.inSeason}>
          <FlavourCard flavour={inSeason.flavour} name={inSeason.item} price={inSeason.item.price} />
        </Section>

        <Section id={sections.open} label={labels.open}>
          <Columns count={2} align="end">
            <Stack>
              <Stack gap="xs">
                <Type role="display" as="p" aria-hidden>
                  {hours.opens} – {hours.closes}
                </Type>
                <Type role="body" as="p" ink="muted">
                  <span aria-hidden>{hours.written}</span>
                  <VisuallyHidden>{hours.spoken}</VisuallyHidden>
                </Type>
              </Stack>
              <Stack as="address" gap="xs">
                <Label ink="muted">{address.name}</Label>
                <Stack gap="none">
                  {address.lines.map((line) => (
                    <Type key={line} role="body">
                      {line}
                    </Type>
                  ))}
                </Stack>
              </Stack>
            </Stack>
            <Stage engine="alive" ground="cream-100">
              <TiungCat width="100%" height="100%" />
            </Stage>
          </Columns>
        </Section>

        <Stack as="footer" gap="md">
          <Rule tone="strong" />
          <Row justify="between" align="baseline">
            <Logo width={120} />
            <Label ink="muted">{signOff}</Label>
          </Row>
        </Stack>
      </Sheet>
    </>
  );
}
