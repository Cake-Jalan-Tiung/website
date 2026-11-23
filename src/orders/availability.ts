// What can be ordered right now, as staff set it from the kitchen screen: online ordering can be
// paused, and a dish can be sold out. Both end on their own (at the start of the next shop day)
// unless staff choose "until I turn it back on".
import {addDays, shopClock, shopInstant} from '../storefront/hours';
import type {Storefront} from '../storefront/model';
import {CartError, TEST_DISH, orderableDish, type CartLine} from './model';

/** `until` is when it opens again by itself; null means only staff open it. */
export type Closure = {until: string | null};
export type Availability = {ordersPaused: Closure | null; soldOut: Record<string, Closure>};

export const OPEN: Availability = {ordersPaused: null, soldOut: {}};

/** How long staff close something for. */
export type CloseFor = 'today' | 'until-reopened';
export const parseCloseFor = (text: string): CloseFor | null => (text === 'today' || text === 'until-reopened' ? text : null);

/** A closure row as stored: `orders`, or `dish:<id>`. */
export type ClosureRow = {subject: string; until: string | null};
export const ORDERS_SUBJECT = 'orders';
export const dishSubject = (dishId: string) => `dish:${dishId}`;

/** The rows still in force at `now`, as the site reads them. */
export function availabilityFrom(rows: readonly ClosureRow[], now: Date): Availability {
  const live = rows.filter((row) => row.until === null || Date.parse(row.until) > now.getTime());
  const soldOut: Record<string, Closure> = {};
  let ordersPaused: Closure | null = null;
  for (const row of live) {
    if (row.subject === ORDERS_SUBJECT) ordersPaused = {until: row.until};
    else if (row.subject.startsWith('dish:')) soldOut[row.subject.slice('dish:'.length)] = {until: row.until};
  }
  return {ordersPaused, soldOut};
}

/** When a closure made at `now` for `closeFor` ends: the start of the shop's next day, or never. */
export function closureEnds(store: Storefront, closeFor: CloseFor, now: Date): string | null {
  if (closeFor === 'until-reopened') return null;
  return shopInstant(store.timeZone, addDays(shopClock(store.timeZone, now), 1), 0).toISOString();
}

/**
 * Refuses a cart the shop cannot take right now. The staff test order goes through a pause,
 * so a real payment can still be tried while the shop is closed to customers.
 */
export function assertAvailable(store: Storefront, cart: readonly CartLine[], availability: Availability) {
  const isTest = cart.some((line) => line.dishId === TEST_DISH.id);
  if (availability.ordersPaused && !isTest) {
    throw new CartError('We are not taking online orders right now. You are welcome to order at the counter.');
  }
  const soldOut = cart.flatMap((line) => {
    const dish = orderableDish(store, line.dishId);
    return dish && availability.soldOut[dish.id] ? [dish] : [];
  });
  if (soldOut.length > 0) {
    const names = soldOut.map((dish) => dish.name).join(' and ');
    throw new CartError(`${names} ${soldOut.length === 1 ? 'is' : 'are'} sold out for now. Remove ${soldOut.length === 1 ? 'it' : 'them'} to carry on.`);
  }
}
