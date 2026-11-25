// The shape of an F&B storefront: what a shop has to say, independent of how it is drawn.
// A second client fills the same shape with its own content and brand layer.
import type {ComponentType} from 'react';
import type {MarkProps} from '../marks/marks.generated';
import type {Flavour, Staged} from '../system/model';
import type {Span} from './hours';
import type {DeliveryArea} from '../delivery/model';

/** A drawing on a ground it may legally sit on (Law 04 holds through `Staged`). */
export type Drawing = Staged & {mark: ComponentType<MarkProps>};

/**
 * A dish as the shop sells it: name, description and price as its ordering platform lists
 * them. Its photo is found by id (see photos.ts); without one it shows its drawing, if any.
 */
export type Dish = {id: string; name: string; description?: string; price: number; drawing?: Drawing};

/**
 * A kind of thing the shop sells. Its dishes live inside it, so nothing points at a missing
 * category. `cover` is the dish whose photo stands in until the category has its own.
 * `servedBetween` limits when its dishes can be picked up (breakfast only in the morning).
 */
export type Category = {id: string; name: string; tile: Drawing; dishes: readonly Dish[]; servedBetween?: Span; cover?: string};

export type Action = {label: string; href: string};

/** One line per day, Monday first; `open: null` is closed. */
export type Week = readonly {day: string; open: Span | null}[];

/** How pick-up times are offered: the soonest after paying, the step between times, how many days ahead. */
export type Pickup = {leadMinutes: number; slotMinutes: number; daysAhead: number};

/** A public rating, with where and when it was read, so it can be checked and kept current. */
export type Proof = {rating: number; reviews: number; source: string; asOf: string; href: string};

export type Storefront = {
  name: string;
  /** The name under the icon on a phone's home screen, where about 12 characters fit; omit when the name fits. */
  shortName?: string;
  /** The registered company behind the shop, for receipts; omit to print none. */
  legalName?: string;
  address: readonly string[];
  phone: {display: string; href: string};
  week: Week;
  /** The week in one line, for the menu and the footer. */
  hoursLine: string;
  /** The line every page ends on. */
  signOff: string;
  nav: readonly Action[];
  /** Where to order delivery while a deploy only takes pick-up orders (DELIVERY unset); omit once delivery is live. */
  delivery?: Action;
  /** How the site delivers when the deploy has a courier (src/delivery/); omit for pick-up only. */
  deliveryArea?: DeliveryArea;
  /** The menu, which is also where an order starts. */
  menu: Action;
  /** Short facts under the hero; each must be true and checkable. */
  facts: readonly {title: string; line: string}[];
  /** Omit to show no rating anywhere. */
  proof?: Proof;
  categories: readonly Category[];
  /** Dish ids, in the order the shop ranks them. */
  bestSellers: readonly string[];
  /** Category ids whose dishes checkout may offer beside a bag: things that go with an order, not a second meal. */
  addOns: readonly string[];
  /** The dish whose photo stands in for the hero until there is a `hero` photo. */
  heroCover?: string;
  /** Dishes for the hero's counter, in place of its photo: each must have a drawing, which is what the counter shows. */
  counter?: {dishes: readonly string[]};
  /** The season's dish, when the shop has one. */
  inSeason?: {flavour: Flavour; dishId: string};
  mapHref: string;
  /** The shop's IANA time zone: "today", opening hours and pick-up times are read in it, not in the server's. */
  timeZone: string;
  pickup: Pickup;
};

export const allDishes = (store: Storefront) => store.categories.flatMap((category) => category.dishes);

const indexes = new WeakMap<Storefront, ReadonlyMap<string, Dish>>();
/** Every dish by id, built once per storefront. */
export function dishIndex(store: Storefront): ReadonlyMap<string, Dish> {
  let index = indexes.get(store);
  if (!index) {
    index = new Map(allDishes(store).map((dish) => [dish.id, dish]));
    indexes.set(store, index);
  }
  return index;
}

/** Dishes by id, in the order given; throws on an id that names no dish, so a typo fails loudly. */
export function dishesById(store: Storefront, ids: readonly string[]): Dish[] {
  return ids.map((id) => {
    const dish = dishIndex(store).get(id);
    if (!dish) throw new Error(`storefront: no dish has the id "${id}"`);
    return dish;
  });
}

