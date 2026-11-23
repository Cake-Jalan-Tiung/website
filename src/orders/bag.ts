// The bag, in the browser: dish ids and quantities, kept in localStorage across visits and
// in step across tabs. The server renders it empty; it fills in once the page is live.
import {useSyncExternalStore} from 'react';
import {storefront} from '../site/content';
import {MAX_QUANTITY, orderableDish, type CartLine} from './model';

const KEY = 'cjt.bag.v1';
const EMPTY: readonly CartLine[] = [];
let lines: readonly CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

/**
 * Reads a stored bag and keeps only what can still be ordered: dishes on today's menu (or the
 * staff test item, which the server allows only for staff), once
 * each, whole quantities from 1 to the maximum. An old or edited bag never breaks a page.
 */
export function parseBag(raw: string | null): readonly CartLine[] {
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : [];
  } catch {
    return EMPTY;
  }
  return parseLines(value);
}

/** The same rules for lines already parsed from JSON, such as a remembered order's. */
export function parseLines(value: unknown): readonly CartLine[] {
  if (!Array.isArray(value)) return EMPTY;
  const seen = new Set<string>();
  return value.flatMap((line: unknown) => {
    if (typeof line !== 'object' || line === null || !('dishId' in line) || !('quantity' in line)) return [];
    const {dishId, quantity} = line;
    if (typeof dishId !== 'string' || !orderableDish(storefront, dishId) || seen.has(dishId)) return [];
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return [];
    seen.add(dishId);
    return [{dishId, quantity: Math.min(quantity, MAX_QUANTITY)}];
  });
}

function load() {
  if (!loaded && typeof window !== 'undefined') {
    loaded = true;
    lines = parseBag(window.localStorage.getItem(KEY));
    window.addEventListener('storage', (event) => {
      if (event.key !== KEY) return;
      lines = parseBag(event.newValue);
      listeners.forEach((listener) => listener());
    });
  }
  return lines;
}

function commit(next: readonly CartLine[]) {
  lines = next;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useBag = () => useSyncExternalStore(subscribe, load, () => EMPTY);
const quantityOf = (dishId: string) => load().find((line) => line.dishId === dishId)?.quantity ?? 0;
/** One dish's quantity; a component using it re-renders only when that number changes. */
export const useBagQuantity = (dishId: string) => useSyncExternalStore(subscribe, () => quantityOf(dishId), () => 0);
/** False on the server and in the first paint, true once the stored bag has been read. */
export const useBagReady = () => useSyncExternalStore(subscribe, () => true, () => false);

export const bag = {
  set(dishId: string, quantity: number) {
    const clamped = Math.max(0, Math.min(MAX_QUANTITY, quantity));
    const current = load();
    const line = {dishId, quantity: clamped};
    if (clamped === 0) return commit(current.filter((l) => l.dishId !== dishId));
    commit(current.some((l) => l.dishId === dishId) ? current.map((l) => (l.dishId === dishId ? line : l)) : [...current, line]);
  },
  add(dishId: string) {
    bag.set(dishId, quantityOf(dishId) + 1);
  },
  /**
   * Makes sure the bag holds at least these lines, each dish at no less than its quantity, in
   * one change. Repeating it changes nothing, so a second tap never doubles an order. Lines go
   * through the bag's own rules first: a dish no longer on the menu is left out.
   */
  include(wanted: readonly CartLine[]) {
    const next = new Map(load().map((line) => [line.dishId, line.quantity]));
    for (const line of parseLines(wanted)) next.set(line.dishId, Math.max(next.get(line.dishId) ?? 0, line.quantity));
    commit([...next].map(([dishId, quantity]) => ({dishId, quantity})));
  },
  clear() {
    commit(EMPTY);
  },
};

export const countOf = (cart: readonly CartLine[]) => cart.reduce((sum, line) => sum + line.quantity, 0);

// The orders this bag has gone to pay for. The bag empties when one of them is paid, and only
// then: an order page opened later, for an older order or from another tab, never touches a bag
// the customer is building now.
const PAYING_KEY = 'cjt.paying.v1';
/** Retries of a failed payment each make an order; a few are kept, as any of them may be the one paid. */
const PAYING_KEPT = 5;

function readPaying(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PAYING_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Checkout calls this as the bag leaves to be paid for as `orderId`. */
export function payingFor(orderId: string) {
  window.localStorage.setItem(PAYING_KEY, JSON.stringify([orderId, ...readPaying().filter((id) => id !== orderId)].slice(0, PAYING_KEPT)));
}

/** The order page calls this once `orderId` is paid: if this bag went to pay for it, the bag has done its job. */
export function settleBag(orderId: string) {
  if (!readPaying().includes(orderId)) return;
  window.localStorage.removeItem(PAYING_KEY);
  bag.clear();
}
