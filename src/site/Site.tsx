import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {Link} from '@astryxdesign/core/Link';
import {Text} from '@astryxdesign/core/Text';
import {VStack} from '@astryxdesign/core/VStack';
import {Type} from '../system/Type';
import {BilingualLabel, Label, Logo, MenuBoard, PinkDot, Price, TypesetWordmark} from '../system/components';
import {BurungTiung, marks} from '../marks/marks.generated';
import {address, boardPlace, hours, inSeason, labels, menu, promise, signOff, soldOutLine, type Bilingual} from './content';

const CONTENT_WIDTH = 1248;

// Grammar sheet 15, form 02: the stacked pair. Malay is the heading, English sits under it.
function SectionTitle({label, id}: {label: Bilingual; id: string}) {
  return (
    <VStack gap={1}>
      <Type role="head" as="h2" id={id} lang="ms">
        {label.bm}
      </Type>
      <Type role="caption" ink="muted">
        {label.en}
      </Type>
    </VStack>
  );
}

function Awning() {
  return (
    <VStack as="header" hAlign="center" paddingBlock={6} paddingInline={4} style={{background: 'var(--cjt-color-blue)'}}>
      <Logo width={260} onBlue />
    </VStack>
  );
}

function Nav() {
  const links: Array<{href: string; label: Bilingual}> = [
    {href: '#hari-ini', label: labels.today},
    {href: '#musim-ini', label: labels.inSeason},
    {href: '#buka', label: labels.open},
  ];
  return (
    <HStack as="nav" aria-label="Sections" justify="center" gap={6} wrap="wrap" paddingBlock={3} paddingInline={4}>
      {links.map(({href, label}) => (
        <Link key={href} href={href}>
          <Label ink="blue">
            {label.bm} · {label.en}
          </Label>
        </Link>
      ))}
    </HStack>
  );
}

function Hero() {
  return (
    <Grid columns={{minWidth: 320, max: 2}} gap={8} align="center">
      <VStack gap={4}>
        <Heading level={1} type="display-1" textWrap="balance">
          {promise}
        </Heading>
        <Text color="secondary" display="block" style={{maxWidth: 520}}>
          Every little mark here was drawn by hand — with a lot of love, and a little flour.
        </Text>
      </VStack>
      <Card variant="cream-light" padding={8}>
        <VStack height={420} hAlign="center" vAlign="center">
          <BurungTiung width="100%" height="100%" />
        </VStack>
      </Card>
    </Grid>
  );
}

function Today() {
  const bakes = marks.filter((m) => m.family === 'pastry' || m.family === 'drink');
  return (
    <VStack as="section" gap={6} aria-labelledby="hari-ini">
      <SectionTitle id="hari-ini" label={labels.today} />
      <Grid columns={{minWidth: 340, max: 2}} gap={8} align="start">
        <MenuBoard items={menu} place={boardPlace} label={labels.today} footnote={soldOutLine} />
        <VStack gap={3}>
          <BilingualLabel label={labels.freshFromOven} />
          <Grid columns={{minWidth: 150, max: 3}} gap={2}>
            {bakes.map(({name, label, Component}) => (
              <VStack key={name} gap={1}>
                <Card variant="cream-light" padding={3}>
                  <VStack height={150} hAlign="center" vAlign="center">
                    <Component width="100%" height="100%" />
                  </VStack>
                </Card>
                <Label ink="muted">{label}</Label>
              </VStack>
            ))}
          </Grid>
        </VStack>
      </Grid>
    </VStack>
  );
}

function InSeason() {
  const {item, flavour, word} = inSeason;
  return (
    <VStack as="section" gap={6} aria-labelledby="musim-ini">
      <SectionTitle id="musim-ini" label={labels.inSeason} />
      <Card variant={flavour} padding={10}>
        <VStack gap={8}>
          <HStack gap={1.5} align="center">
            <TypesetWordmark />
            <PinkDot />
          </HStack>
          <VStack gap={2}>
            <Label>{word}</Label>
            <Heading level={3} type="display-2" color="inherit">
              <span lang="ms">{item.bm}</span>
            </Heading>
            <Text color="inherit">
              {item.en}
            </Text>
          </VStack>
          <Price amount={item.price} />
        </VStack>
      </Card>
    </VStack>
  );
}

function Visit() {
  return (
    <VStack as="section" gap={6} aria-labelledby="buka">
      <SectionTitle id="buka" label={labels.open} />
      <Grid columns={{minWidth: 280, max: 2}} gap={8} align="end">
        <VStack gap={1}>
          <Heading level={3} type="display-1" color="accent" aria-label={hours.spoken}>
            {hours.opens} – {hours.closes}
          </Heading>
          <Text color="secondary">{hours.written}</Text>
        </VStack>
        <VStack as="address" gap={0.5} style={{fontStyle: 'normal'}}>
          <Label ink="muted">Cake Jalan Tiung</Label>
          {address.lines.map((line) => (
            <Text key={line} display="block">
              {line}
            </Text>
          ))}
        </VStack>
      </Grid>
    </VStack>
  );
}

function Footer() {
  return (
    <VStack as="footer" gap={3}>
      <Divider />
      <HStack justify="between" align="end" wrap="wrap" gap={3}>
        <Logo width={120} />
        <Label ink="muted">{signOff}</Label>
      </HStack>
    </VStack>
  );
}

export function Site() {
  return (
    <VStack gap={0}>
      <Awning />
      <Nav />
      <VStack as="main" gap={10} paddingBlock={10} paddingInline={4} maxWidth={CONTENT_WIDTH} width="100%" style={{marginInline: 'auto'}}>
        <Hero />
        <Today />
        <InSeason />
        <Visit />
        <Footer />
      </VStack>
    </VStack>
  );
}
