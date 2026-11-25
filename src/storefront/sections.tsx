// The storefront's sections, built from the system's primitives and brand components. Each
// takes its content as props, so the same structure serves any shop that fills the
// `Storefront` shape: sticky header, hero with rating and its action, facts,
// best-seller cards, category tiles, menu rows, season band, visit, footer.
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Field} from '../system/Field';
import {Label, PinkDot, Price, Stage, TypesetWordmark} from '../system/components';
import {PrimaryLockup} from '../marks/marks.generated';
import {InstallEntry} from './install-offer';
import {Band, Columns, Row, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {dishIndex, dishesById, type Action, type Category, type Dish, type Drawing, type Proof, type Storefront} from './model';
import {formatSpan, shopClock} from './hours';
import {photoFor} from './photos';
import {AddToBag, BagButton, BagStatus, Cta, formatPrice, PausedNotice} from './bag';
import {useAvailability} from '../orders/availability-store';
import {OpenDish, openDish} from './sheet';
import {Counter} from './counter';
import {StoreLink} from './link';
import {LastOrder} from './again';
import {PickupPromise} from './promise';
import {count as counted} from '../lib/format';
import {useDelivers} from './delivers';
import s from './storefront.module.css';

/**
 * Browsing: one slim sticky bar with the shop's lockup home, the shop's pages and Order now
 * or the bag. Checkout and the order page are `focus`: no nav, only the way home and back to
 * the menu, so nothing pulls away from paying.
 */
export function StoreHeader({store, mode = 'browse', onMenu = false}: {store: Storefront; mode?: 'browse' | 'focus'; onMenu?: boolean}) {
  return (
    <>
      <Field as="header" colour="paper" outlined={false} className={s.header}>
        <div className={s.headerInner}>
          <StoreLink href="/" className={s.brand} aria-label={`${store.name}, home`}>
            <PrimaryLockup className={s.lockup} aria-hidden />
          </StoreLink>
          {mode === 'browse' ? (
            <>
              <nav aria-label="Main" className={s.nav} data-fit="scrolls">
                {store.nav.map((action) => (
                  <Link key={action.href} href={action.href}>
                    <Label ink="blue">{action.label}</Label>
                  </Link>
                ))}
              </nav>
              <span className={s.headerAction}>
                <BagButton store={store} onMenu={onMenu} />
              </span>
            </>
          ) : (
            <StoreLink href={store.menu.href} className={s.back}>
              <Label ink="blue">← Menu</Label>
            </StoreLink>
          )}
        </div>
        <BagStatus store={store} />
      </Field>
      {mode === 'browse' ? (
        <>
          <PausedNotice />
          <LastOrder store={store} />
        </>
      ) : null}
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

/** Ordering's one big action, and the other way to order beside it as a quiet button. */
function Actions({primary, secondary}: {primary: Action; secondary?: Action}) {
  return (
    <Stack gap="sm">
      <Cta href={primary.href}>{primary.label}</Cta>
      {secondary ? (
        <Row gap="sm">
          <Button variant="secondary" size="lg" label={secondary.label} href={secondary.href} />
        </Row>
      ) : null}
    </Stack>
  );
}

type Ratio = '1 / 1' | '4 / 3';

/**
 * A photo by id in a box of fixed proportions, or, until there is one, its drawing or the
 * wordmark on cream in the same box, so a grid keeps its rhythm while photos arrive.
 */
export function Media({id, cover, alt, ratio, sizes, eager = false, drawing}: {
  id: string;
  cover?: string;
  alt: string;
  ratio: Ratio;
  /** How wide the box is shown, as an img's `sizes`: the browser fetches the smallest photo that stays sharp. */
  sizes: string;
  /** In the first screen: fetched at once and first, not when scrolled to. */
  eager?: boolean;
  drawing?: Drawing;
}) {
  const photo = photoFor(id, cover);
  return (
    <span className={s.media} style={{aspectRatio: ratio}}>
      {photo ? (
        <img src={photo.src} srcSet={photo.srcSet} sizes={sizes} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" />
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

const orderLabel = (delivers: boolean) => (delivers ? 'Order now' : 'Order for pick-up');

/** "Order for pick-up" ("Order now" where the site delivers too), or, while staff have paused online orders, "See the menu": the same way in, without promising an order. */
function useOrderLabel() {
  const delivers = useDelivers();
  return useAvailability().ordersPaused ? 'See the menu' : orderLabel(delivers);
}
const HERO_ACTION = 'hero-order';

/** The foot bar's stand-in for the hero's button, once that has scrolled away. */
export const heroIdle = (store: Storefront, delivers: boolean) => ({action: {label: orderLabel(delivers), href: store.menu.href}, standsIn: HERO_ACTION});

/**
 * The first screen: a picture the shop composes (`visual`), its drawings, or its hero photo, first
 * on a phone so the page opens on it; the rating, the shop's line, then one big Order. With a
 * `street`, a wide window becomes the street itself: the street fills the screen behind the words,
 * which sit on its wall, and the picture stands at full height at its end.
 */
export function Hero({title, art, store, visual, street}: {title: string; art: Drawing; store: Storefront; visual?: ReactNode; street?: ReactNode}) {
  const orderLabel = useOrderLabel();
  // The hero borrows a dish's photo until it has its own, so its alt names that dish.
  const shown = photoFor('hero') ? store.name : (store.heroCover && dishIndex(store).get(store.heroCover)?.name) || store.name;
  const photo = <Media id="hero" cover={store.heroCover} alt={shown} ratio="4 / 3" sizes="(max-width: 899px) 100vw, 50vw" eager drawing={art} />;
  return (
    <>
      {visual || store.counter ? null : <span className={s.heroPhone}>{photo}</span>}
      <Field colour="cream-100" outlined={false} className={s.heroBand} data-street={street ? '' : undefined}>
        {street ? <span className={s.heroStreet}>{street}</span> : null}
        <div className={s.hero}>
          <div className={s.heroText}>
            {store.proof ? <Rating proof={store.proof} /> : null}
            <Type role="display" as="h1" className={s.headline}>
              {title}
            </Type>
            <span className={s.heroActions}>
              <Cta href={store.menu.href} id={HERO_ACTION}>
                {orderLabel}
              </Cta>
              <PickupPromise store={store} />
            </span>
          </div>
          {visual || store.counter ? (
            <span className={s.heroArt}>{visual ?? (store.counter ? <Counter dishes={dishesById(store, store.counter.dishes)} more={store.menu} /> : null)}</span>
          ) : (
            <span className={s.heroMedia}>{photo}</span>
          )}
        </div>
      </Field>
    </>
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

/** The run of sections between the hero and the visit band, on the sheet's gutters; `dense` for a long list such as the menu. */
export function Sections({dense = false, children}: {dense?: boolean; children: ReactNode}) {
  return (
    <div className={s.sections} data-dense={dense ? '' : undefined}>
      {children}
    </div>
  );
}

/** A section: its heading, an optional note and link out, then its content. */
export function StoreSection({id, title, note, action, children}: {id: string; title: string; note?: string; action?: Action; children: ReactNode}) {
  return (
    <section className={s.section} aria-labelledby={id}>
      <Row justify="between" align="end" gap="md">
        <Stack gap="xs">
          <Type role="head" as="h2" id={id} className={s.sectionTitle}>
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
    </section>
  );
}

/**
 * A dish: photo with + on its corner, name, price, the start of its description. The name is a
 * button stretched over the card, so a tap anywhere but + opens the dish.
 */
function DishCard({dish, sizes, eager, brief = false}: {dish: Dish; sizes: string; eager?: boolean; brief?: boolean}) {
  return (
    <article className={s.card}>
      <span className={s.cardMedia}>
        <Media id={dish.id} alt="" ratio="1 / 1" sizes={sizes} eager={eager} drawing={dish.drawing} />
        <span className={s.corner}>
          <AddToBag dish={dish} onOpen={() => openDish(dish.id)} />
        </span>
      </span>
      <Stack gap="xs">
        <Type role="body" as="h3" className={s.dishName}>
          <OpenDish dish={dish} />
        </Type>
        <Type role="body" className={s.money}>
          {formatPrice(dish.price)}
        </Type>
        {dish.description && !brief ? (
          <span className={s.clamp} data-fit="clips">
            <Type role="caption" ink="secondary">
              {dish.description}
            </Type>
          </span>
        ) : null}
      </Stack>
    </article>
  );
}

export function DishGrid({dishes}: {dishes: readonly Dish[]}) {
  return (
    <Columns count={4} narrow={2} gap="lg">
      {dishes.map((dish) => (
        <DishCard key={dish.id} dish={dish} sizes="(max-width: 899px) 50vw, 25vw" />
      ))}
    </Columns>
  );
}

/**
 * Dishes to choose between first, such as the best sellers at the top of the menu: a row a thumb
 * swipes through on a phone, the next card cut by the edge so the row reads as more; four across
 * on a wide screen. Name and price only; the rows below carry the descriptions.
 */
export function DishStrip({dishes}: {dishes: readonly Dish[]}) {
  return (
    <ul className={s.strip} data-fit="scrolls">
      {dishes.map((dish, index) => (
        <li key={dish.id} className={s.stripItem}>
          <DishCard dish={dish} sizes="(max-width: 899px) 40vw, 25vw" eager={index < 2} brief />
        </li>
      ))}
    </ul>
  );
}

/** One tile per kind of thing the shop sells, each a link into the menu. */
export function CategoryTiles({categories, menuHref}: {categories: readonly Category[]; menuHref: string}) {
  return (
    <Columns count={3} narrow={2}>
      {categories.map((category) => (
        <StoreLink key={category.id} href={`${menuHref}#${category.id}`} className={`${s.tileLink} ${s.card}`}>
          <Media id={category.id} cover={category.cover} alt="" ratio="4 / 3" sizes="(max-width: 899px) 50vw, 33vw" drawing={category.tile} />
          <Stack as="span" gap="none">
            <Type role="subhead" className={s.tileName}>
              {category.name}
            </Type>
            <Type role="caption" ink="secondary">
              {counted(category.dishes.length, 'item', 'items')}
            </Type>
          </Stack>
        </StoreLink>
      ))}
    </Columns>
  );
}

/**
 * The categories as a rail that stays under the header: a tap jumps to one, and the rail marks
 * whichever the customer has scrolled to, keeping it in view.
 */
export function CategoryRail({categories}: {categories: readonly Pick<Category, 'id' | 'name'>[]}) {
  const [active, setActive] = useState(categories[0]?.id);
  const [more, setMore] = useState(false);
  const rail = useRef<HTMLElement>(null);

  useEffect(() => {
    const box = rail.current;
    if (!box) return;
    const read = () => setMore(box.scrollLeft + box.clientWidth < box.scrollWidth - 1);
    const observer = new ResizeObserver(read);
    observer.observe(box);
    box.addEventListener('scroll', read, {passive: true});
    return () => {
      observer.disconnect();
      box.removeEventListener('scroll', read);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      // The same line a tapped anchor lands on: the page's scroll padding.
      const line = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) + 1;
      let current = categories[0]?.id;
      for (const category of categories) {
        const section = document.getElementById(category.id)?.closest('section');
        if (section && section.getBoundingClientRect().top <= line) current = category.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [categories]);

  useEffect(() => {
    const box = rail.current;
    const link = box?.querySelector<HTMLElement>('[aria-current]');
    if (!box || !link) return;
    // Smooth only where motion is welcome: the rail's CSS sets scroll-behavior under no-preference.
    box.scrollTo({left: link.offsetLeft - (box.clientWidth - link.offsetWidth) / 2});
  }, [active]);

  return (
    <Field as="nav" colour="paper" outlined={false} aria-label="Categories" className={s.rail}>
      <span ref={rail} className={s.railScroll} data-fit="scrolls">
        {categories.map((category) => (
          <a key={category.id} href={`#${category.id}`} className={s.railLink} aria-current={category.id === active ? 'true' : undefined}>
            <Label>{category.name}</Label>
          </a>
        ))}
      </span>
      {/* While more categories wait past the edge, a square at the end says so and moves the rail on.
          The keyboard reaches every category through its own link, so the square is for the pointer only. */}
      {more ? (
        <button type="button" className={s.railMore} tabIndex={-1} aria-hidden onClick={() => rail.current?.scrollBy({left: rail.current.clientWidth * 0.7})}>
          <Type role="subhead">→</Type>
        </button>
      ) : null}
    </Field>
  );
}

/** A category's dishes as hairline rows: name, two lines of description and price, beside the photo with + on its corner. */
export function MenuList({dishes, store}: {dishes: readonly Dish[]; store: Storefront}) {
  return (
    <ul className={s.menuList}>
      {dishes.map((dish) => (
        <li key={dish.id} className={s.menuRow}>
          <span className={s.menuText}>
            <Type role="body" as="h3" className={s.dishName}>
              <OpenDish dish={dish} />
            </Type>
            {dish.description ? (
              <span className={s.clamp} data-fit="clips">
                <Type role="caption" ink="secondary">
                  {dish.description}
                </Type>
              </span>
            ) : null}
            <Row gap="sm">
              <Type role="body" className={s.money}>
                {formatPrice(dish.price)}
              </Type>
              {store.bestSellers.includes(dish.id) ? <Label>Best seller</Label> : null}
            </Row>
          </span>
          <span className={s.menuMedia}>
            <Media id={dish.id} alt="" ratio="1 / 1" sizes="120px" drawing={dish.drawing} />
            <span className={s.corner}>
              <AddToBag dish={dish} onOpen={() => openDish(dish.id)} />
            </span>
          </span>
        </li>
      ))}
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
  const orderLabel = useOrderLabel();
  const delivers = useDelivers();
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
          <Actions primary={{label: orderLabel, href: store.menu.href}} secondary={delivers ? undefined : store.delivery} />
        </Stack>
        <Media id="shop" alt={`${store.name} shopfront`} ratio="4 / 3" sizes="(max-width: 899px) 100vw, 50vw" drawing={art} />
      </Columns>
    </Band>
  );
}

function FooterLink({href, children}: {href: string; children: ReactNode}) {
  return (
    <StoreLink href={href} className={s.plainLink}>
      <Type role="body">{children}</Type>
    </StoreLink>
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
  const delivers = useDelivers();
  return (
    <Band as="footer" ground="ink">
      <Stack gap="xl">
        <Columns count={4} narrow={2} align="start" gap="lg">
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
            {(delivers ? [{label: 'Order for pick-up or delivery', href: store.menu.href}] : [{label: 'Order for pick-up', href: store.menu.href}, store.delivery]).filter((action) => action !== undefined).map((action) => (
              <FooterLink key={action.href} href={action.href}>
                {action.label}
              </FooterLink>
            ))}
            <InstallEntry />
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
