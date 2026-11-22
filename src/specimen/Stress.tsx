// Every brand component fed the content it was not drawn for: long unbroken words, long
// sentences, missing parts, huge numbers, empty lists. `pnpm fit` loads this page at
// six widths and fails if anything spills. Dev only: it is not a build input.
import {marks} from '../marks/marks.generated';
import {
  BilingualLabel,
  ColourRoles,
  FlavourCard,
  Label,
  Logo,
  MarkTile,
  MenuBoard,
  PageHeader,
  Price,
  RuleList,
  SectionHeader,
  StackedPair,
  Swatch,
  Tile,
  Tiung,
  TypesetWordmark,
  Verdict,
} from '../system/components';
import {Band, Columns, Row, Sheet, Stack} from '../system/layout';
import {legalText, type Ground} from '../system/model';
import {Field} from '../system/Field';

const word = 'Kekpandankayagulamelakaaiscendolubetehtarikrotigaram';
const sentence = 'A caption that keeps going well past the measure it was drawn for, to see where it wraps and whether it pushes its neighbours out of the row or off the sheet.';
const long = {bm: `Roti ${word}`, en: sentence};

export function Stress() {
  return (
    <>
      <Band as="header" ground="blue">
        <Row justify="center">
          <Logo width={1200} />
        </Row>
      </Band>
      <Sheet>
        <PageHeader meta={[word, `Design system ${word}`]} aside={word} title={`${word} ${sentence}`} lede={`${word} ${sentence}`} />

        <Stack>
          <SectionHeader label={`01 · ${word}`} caption={sentence} meta={`Threshold · ${word}`} />
          <SectionHeader label="No caption" meta="Meta only" />
          <SectionHeader label="Label only" />
          <SectionHeader level={3} label={sentence} caption={word} />
        </Stack>

        <Stack>
          <Columns count={3}>
            <Tile engine="lettering" ground="cream-400" label={word} caption={sentence}>
              <Stack as="span" gap="sm" align="center">
                <TypesetWordmark role="head" />
                <BilingualLabel label={long} />
                <StackedPair label={long} role="head" />
              </Stack>
            </Tile>
            <Tile engine="lettering" ground="paper" label="No caption">
              <Price amount={1234567.5} role="display" />
            </Tile>
            <Verdict verdict="never" label={sentence} caption={word}>
              <Logo width={2000} />
            </Verdict>
          </Columns>
          <Columns count={5} narrow={2}>
            {marks.slice(0, 5).map((mark) => (
              <MarkTile key={mark.name} entry={mark} height={120} padding={0} />
            ))}
          </Columns>
          <Row gap="xl" align="end">
            {[0, 1, 16, 32, 33, 4000].map((size) => (
              <Tiung key={size} size={size} />
            ))}
          </Row>
        </Stack>

        <Stack>
          <RuleList
            rules={[
              {status: 'always', name: word, description: sentence},
              {status: 'never', name: sentence, description: word},
            ]}
          />
          <RuleList rules={[]} />
          <ColourRoles roles={[{colour: 'paper', name: word, source: sentence, description: `${word} ${sentence}`}]} />
          <Columns count={5} narrow={2}>
            <Swatch name={word} colour="paper" />
            <Swatch name={sentence} colour="ink" />
          </Columns>
        </Stack>

        <Columns count={5} narrow={2}>
          <FlavourCard flavour="pandan" name={long} line={sentence} price={1234567} />
          <FlavourCard flavour="teh" name={word} />
          <FlavourCard flavour="ube" name="A" price={0} />
        </Columns>

        <Columns count={2}>
          <MenuBoard
            items={[
              {bm: word, en: word, price: 1234567},
              {bm: sentence, en: sentence, price: 0.5},
              {bm: 'A', en: '', price: 8},
            ]}
            place={word}
            label={long}
            footnote={`${word} ${sentence}`}
          />
          <MenuBoard items={[]} place="Jalan Tiung" label={{bm: 'Hari ini', en: 'Today'}} footnote="Habis bila habis" />
        </Columns>

        <Columns count={5} narrow={2}>
          {(Object.keys(legalText) as Ground[]).map((ground) => (
            <Field key={ground} colour={ground}>
              <Stack gap="xs">
                <Label>{ground}</Label>
                <BilingualLabel label={long} />
                <StackedPair label={long} />
                <TypesetWordmark />
              </Stack>
            </Field>
          ))}
        </Columns>
      </Sheet>
    </>
  );
}
