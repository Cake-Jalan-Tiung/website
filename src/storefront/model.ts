// The shape of an F&B storefront: what a shop has to say, independent of how it is drawn.
// A second client fills the same shape with its own content and brand layer.
import type {ComponentType} from 'react';
import type {MarkProps} from '../marks/marks.generated';
import type {Flavour, Staged} from '../system/model';

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
 */
export type Category = {id: string; name: string; tile: Drawing; dishes: readonly Dish[]; note?: string; cover?: string};

export type Action = {label: string; href: string};

/** One line per day, Monday first; `null` is closed. */
export type Week = readonly {day: string; hours: string | null}[];

/** A public rating, with where and when it was read, so it can be checked and kept current. */
export type Proof = {rating: number; reviews: number; source: string; asOf: string; href: string};

export type Storefront = {
  name: string;
  address: readonly string[];
  phone: {display: string; href: string};
  week: Week;
  /** The week in one line, for the ticker and the menu. */
  hoursLine: string;
  /** The line every page ends on. */
  signOff: string;
  /** The passing line over the header: short, true, and current. */
  announcements: readonly string[];
  nav: readonly Action[];
  /** Where an order is placed, one way per fulfilment. */
  order: {delivery: Action; pickup: Action};
  menu: Action;
  /** Short facts under the hero; each must be true and checkable. */
  facts: readonly {title: string; line: string}[];
  /** Omit to show no rating anywhere. */
  proof?: Proof;
  categories: readonly Category[];
  /** Dish ids, in the order the shop ranks them. */
  bestSellers: readonly string[];
  /** The dish whose photo stands in for the hero until there is a `hero` photo. */
  heroCover?: string;
  /** The season's dish, when the shop has one. */
  inSeason?: {flavour: Flavour; dishId: string};
  mapHref: string;
};

export const allDishes = (store: Storefront) => store.categories.flatMap((category) => category.dishes);

/** Dishes by id, in the order given; throws on an id that names no dish, so a typo fails loudly. */
export function dishesById(store: Storefront, ids: readonly string[]): Dish[] {
  const dishes = allDishes(store);
  return ids.map((id) => {
    const dish = dishes.find((d) => d.id === id);
    if (!dish) throw new Error(`storefront: no dish has the id "${id}"`);
    return dish;
  });
}
