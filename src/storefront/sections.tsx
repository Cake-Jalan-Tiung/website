// The storefront's sections, built from the system's primitives and brand components. Each
// takes its content as props, so the same structure serves any shop that fills the
// `Storefront` shape: ticker, sticky header, hero with rating and two actions, facts,
// best-seller cards, category tiles, menu rows, season band, visit, footer.
import type {ReactNode} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Field} from '../system/Field';
import {Label, PinkDot, Price, Stage, Tiung, TypesetWordmark} from '../system/components';
import {Band, Columns, Marquee, Row, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {dishesById, type Action, type Category, type Dish, type Drawing, type Proof, type Storefront} from './model';
import {formatSpan, shopClock} from './hours';
import {photoFor} from './photos';
import {AddToBag, BagButton} from './bag';
import s from './storefront.module.css';

/** The passing line over the header: what is true this week, on ink. */
function Ticker({items}: {items: readonly string[]}) {
  return (
    <Field colour="ink" outlined={false} className={s.ticker}>
      <Marquee gap="lg">
        {items.map((item) => (
          <Row key={item} as="span" gap="lg">
            <Label>{item}</Label>
            <PinkDot />
          </Row>
        ))}
      </Marquee>
    </Field>
  );
}

/** Ticker, then one slim sticky bar: the bird and wordmark home, the shop's pages, and Order now. */
export function StoreHeader({store}: {store: Storefront}) {
  return (
    <>
      <Ticker items={store.announcements} />
      <Field as="header" colour="paper" outlined={false} className={s.header}>
        <div className={s.headerInner}>
          <a href="/" className={s.brand} aria-label={`${store.name}, home`}>
            <Tiung size={32} aria-hidden />
            <span className={s.brandName}>
              <TypesetWordmark role="caption" />
            </span>
          </a>
          <nav aria-label="Main" className={s.nav} data-fit="scrolls">
            {store.nav.map((action) => (
              <Link key={action.href} href={action.href}>
                <Label ink="blue">{action.label}</Label>
              </Link>
            ))}
          </nav>
          <BagButton store={store} />
        </div>
      </Field>
    </>
  );
}

/** The rating as one checkable line, linked to where it was read. */
function Rating({proof}: {proof: Proof}) {
  return (
    <Link href={proof.href} isExternalLink>
      <Type role="body" ink="blue">
        <span aria-hidden>★ </span>
        {proof.rating.toFixed(1)} from {proof.reviews.toLocaleString('en-MY')} {proof.source} reviews
      </Type>
    </Link>
  );
}

function Actions({primary, secondary}: {primary: Action; secondary?: Action}) {
  return (
    <Row gap="sm">
      <Button variant="primary" size="lg" label={primary.label} href={primary.href} />
      {secondary ? <Button variant="secondary" size="lg" label={secondary.label} href={secondary.href} /> : null}
    </Row>
  );
}

type Ratio = '1 / 1' | '4 / 3';

/**
 * A photo by id in a box of fixed proportions, or, until there is one, its drawing or the
 * wordmark on cream in the same box, so a grid keeps its rhythm while photos arrive.
 */
function Media({id, cover, alt, ratio, drawing}: {id: string; cover?: string; alt: string; ratio: Ratio; drawing?: Drawing}) {
  const src = photoFor(id, cover);
  return (
    <span className={s.media} style={{aspectRatio: ratio}}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : drawing ? (
        <Stage {...drawing} height={320} padding={40} />
      ) : (
        <Stage engine="lettering" ground="cream-400" height={320}>
          <Row gap="xs">
            <TypesetWordmark role="label" />
            <PinkDot />
          </Row>
        </Stage>
      )}
    </span>
  );
}

/** The first screen: rating, the shop's line, its two asks, and the hero photo. */
export function Hero({title, lede, art, store}: {title: string; lede: string; art: Drawing; store: Storefront}) {
  return (
    <Band ground="cream-100">
      <Columns count={2} align="center" gap="xl">
        <Stack gap="lg">
          {store.proof ? <Rating proof={store.proof} /> : null}
          <Stack gap="md">
            <Type role="display" as="h1" className={s.headline}>
              {title}
            </Type>
            <Type role="body" as="p" className={s.lede}>
              {lede}
            </Type>
          </Stack>
          <Actions primary={{label: 'Order now', href: store.menu.href}} secondary={store.delivery} />
        </Stack>
        <Media id="hero" cover={store.heroCover} alt={store.name} ratio="1 / 1" drawing={art} />
      </Columns>
    </Band>
  );
}

/** Short true facts in a row, each over a hairline. */
export function Facts({facts}: {facts: Storefront['facts']}) {
  return (
    <ul className={s.facts}>
      {facts.map((fact) => (
        <li key={fact.title} className={s.fact}>
          <Type role="body" className={s.factTitle}>
            {fact.title}
          </Type>
          <Type role="caption" ink="secondary">
            {fact.line}
          </Type>
        </li>
      ))}
    </ul>
  );
}

/** The run of sections between the hero and the visit band, on the sheet's gutters. */
export function Sections({children}: {children: ReactNode}) {
  return <div className={s.sections}>{children}</div>;
}

/** A section: its heading, an optional note and link out, then its content. */
export function StoreSection({id, title, note, action, children}: {id: string; title: string; note?: string; action?: Action; children: ReactNode}) {
  return (
    <Stack as="section" gap="lg" aria-labelledby={id}>
      <Row justify="between" align="end" gap="md">
        <Stack gap="xs">
          <Type role="head" as="h2" id={id}>
            {title}
          </Type>
          {note ? (
            <Type role="body" ink="secondary">
              {note}
            </Type>
          ) : null}
        </Stack>
        {action ? (
          <Link href={action.href}>
            <Label ink="blue">{action.label} →</Label>
          </Link>
        ) : null}
      </Row>
      {children}
    </Stack>
  );
}

/** A dish: photo, name, price under it, the start of its description, and Add. */
function DishCard({dish}: {dish: Dish}) {
  return (
    <article className={s.card}>
      <Media id={dish.id} alt={dish.name} ratio="1 / 1" drawing={dish.drawing} />
      <Stack gap="xs">
        <Type role="body" as="h3" className={s.dishName}>
          {dish.name}
        </Type>
        <Price amount={dish.price} role="body" />
        {dish.description ? (
          <span className={s.clamp} data-fit="clips">
            <Type role="caption" ink="secondary">
              {dish.description}
            </Type>
          </span>
        ) : null}
      </Stack>
      <AddToBag dish={dish} />
    </article>
  );
}

export function DishGrid({dishes}: {dishes: readonly Dish[]}) {
  return (
    <Columns count={4} narrow={2} gap="lg">
      {dishes.map((dish) => (
        <DishCard key={dish.id} dish={dish} />
      ))}
    </Columns>
  );
}

/** One tile per kind of thing the shop sells, each a link into the menu. */
export function CategoryTiles({categories, menuHref}: {categories: readonly Category[]; menuHref: string}) {
  return (
    <Columns count={3} narrow={2}>
      {categories.map((category) => (
        <a key={category.id} href={`${menuHref}#${category.id}`} className={`${s.tileLink} ${s.card}`}>
          <Media id={category.id} cover={category.cover} alt={category.name} ratio="4 / 3" drawing={category.tile} />
          <Stack as="span" gap="none">
            <Type role="subhead" className={s.tileName}>
              {category.name}
            </Type>
            <Type role="caption" ink="secondary">
              {category.dishes.length} items
            </Type>
          </Stack>
        </a>
      ))}
    </Columns>
  );
}

/** A category's dishes as hairline rows: photo if there is one, name, full description, price and Add. */
export function MenuList({dishes, store}: {dishes: readonly Dish[]; store: Storefront}) {
  return (
    <ul className={s.menuList}>
      {dishes.map((dish) => {
        const photo = photoFor(dish.id);
        return (
          <li key={dish.id} className={s.menuRow}>
            {photo ? <img src={photo} alt="" loading="lazy" className={s.thumb} /> : <span className={s.thumb} aria-hidden />}
            <span className={s.menuText}>
              <Type role="subhead" as="h3">
                {dish.name}
              </Type>
              {dish.description ? (
                <Type role="caption" ink="secondary">
                  {dish.description}
                </Type>
              ) : null}
              {store.bestSellers.includes(dish.id) ? <Label ink="blue">Best seller</Label> : null}
            </span>
            <span className={s.menuBuy}>
              <Price amount={dish.price} />
              <AddToBag dish={dish} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The season's dish as a full band in its flavour, when the shop names one. */
export function SeasonBand({store, id}: {store: Storefront; id: string}) {
  if (!store.inSeason) return null;
  const [dish] = dishesById(store, [store.inSeason.dishId]);
  return (
    <Band as="section" ground={store.inSeason.flavour} aria-labelledby={id}>
      <Stack gap="xl">
        <Type role="head" as="h2" id={id}>
          In season
        </Type>
        <Row justify="between" align="end" gap="md">
          <Type role="display" as="p">
            {dish.name}
          </Type>
          <Price amount={dish.price} role="display" />
        </Row>
      </Stack>
    </Band>
  );
}

function Address({lines}: {lines: readonly string[]}) {
  return (
    <Stack gap="none">
      {lines.map((line) => (
        <Type key={line} role="body">
          {line}
        </Type>
      ))}
    </Stack>
  );
}

/** The week, one row a day, today marked. */
function WeekHours({week, timeZone}: {week: Storefront['week']; timeZone: string}) {
  const today = shopClock(timeZone).dayIndex;
  return (
    <dl className={s.week}>
      {week.map((row, index) => (
        <div key={row.day} className={s.weekRow} data-today={index === today ? '' : undefined}>
          <dt>
            <Type role="body">
              {row.day}
              {index === today ? ' (today)' : ''}
            </Type>
          </dt>
          <dd>
            <Type role="body" ink={row.open ? undefined : 'secondary'}>
              {row.open ? formatSpan(row.open) : 'Closed'}
            </Type>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Hours by day, address, phone and map, the two ways to order, beside the shop photo. */
export function Visit({store, id, art}: {store: Storefront; id: string; art: Drawing}) {
  return (
    <Band as="section" ground="cream-400" aria-labelledby={id}>
      <Columns count={2} align="center" gap="xl">
        <Stack gap="lg">
          <Type role="head" as="h2" id={id}>
            Visit us
          </Type>
          <WeekHours week={store.week} timeZone={store.timeZone} />
          <Stack as="address" gap="sm">
            <Address lines={store.address} />
            <Row gap="md">
              <Link href={store.phone.href}>{store.phone.display}</Link>
              <Link href={store.mapHref} isExternalLink>
                Open in Google Maps
              </Link>
            </Row>
          </Stack>
          <Actions primary={{label: 'Order for pick-up', href: store.menu.href}} secondary={store.delivery} />
        </Stack>
        <Media id="shop" alt={`${store.name} shopfront`} ratio="4 / 3" drawing={art} />
      </Columns>
    </Band>
  );
}

function FooterLink({href, children}: {href: string; children: ReactNode}) {
  return (
    <a href={href} className={s.plainLink}>
      <Type role="body">{children}</Type>
    </a>
  );
}

function FooterColumn({title, children}: {title: string; children: ReactNode}) {
  return (
    <Stack gap="sm">
      <Label ink="secondary">{title}</Label>
      {children}
    </Stack>
  );
}

/** The sign-off, then the menu, ordering and the shop, then the legal line. */
export function StoreFooter({store}: {store: Storefront}) {
  return (
    <Band as="footer" ground="ink">
      <Stack gap="xl">
        <Columns count={4} align="start" gap="lg">
          <Stack gap="md">
            <Type role="subhead" as="p">
              {store.signOff}
            </Type>
            <TypesetWordmark role="label" />
          </Stack>
          <FooterColumn title="Menu">
            {store.categories.map((category) => (
              <FooterLink key={category.id} href={`${store.menu.href}#${category.id}`}>
                {category.name}
              </FooterLink>
            ))}
          </FooterColumn>
          <FooterColumn title="Order">
            {[{label: 'Order for pick-up', href: store.menu.href}, store.delivery].filter((action) => action !== undefined).map((action) => (
              <FooterLink key={action.href} href={action.href}>
                {action.label}
              </FooterLink>
            ))}
          </FooterColumn>
          <FooterColumn title="Visit">
            <Address lines={store.address} />
            <Type role="body" ink="secondary">
              {store.hoursLine}
            </Type>
            <FooterLink href={store.phone.href}>{store.phone.display}</FooterLink>
            <FooterLink href={store.mapHref}>Google Maps</FooterLink>
          </FooterColumn>
        </Columns>
        <p className={s.legal}>
          <Type role="caption" ink="secondary">
            © {shopClock(store.timeZone).year} {store.name}
          </Type>
        </p>
      </Stack>
    </Band>
  );
}
