// The customer's last paid order, in the browser: enough to find it again (its page, its code)
// and to order the same again. It is written once the money is in, so an abandoned payment
// never comes back as "your order". Read the same way as the bag: empty on the server, filled
// once the page is live, in step across tabs.
import {useSyncExternalStore} from 'react';
import {isRecord, textAt} from '../lib/guards';
import {parseLines} from './bag';
import {TEST_DISH, type CartLine} from './model';
import type {Availability} from './availability';

export type RecentOrder = {id: string; code: string; pickupAt: string; lines: readonly CartLine[]};

const KEY = 'cjt.recent.v1';
let recent: RecentOrder | null = null;
let loaded = false;
const listeners = new Set<() => void>();

/** A stored order, or null for anything that is not one; its lines go through the bag's own rules. */
export function parseRecent(raw: string | null): RecentOrder | null {
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const id = textAt(value, 'id');
  const code = textAt(value, 'code');
  const pickupAt = textAt(value, 'pickupAt');
  const lines = parseLines(value.lines).filter((line) => line.dishId !== TEST_DISH.id);
  if (!id || !code || Number.isNaN(Date.parse(pickupAt)) || lines.length === 0) return null;
  return {id, code, pickupAt, lines};
}

function load() {
  if (!loaded && typeof window !== 'undefined') {
    loaded = true;
    recent = parseRecent(window.localStorage.getItem(KEY));
    window.addEventListener('storage', (event) => {
      if (event.key !== KEY) return;
      recent = parseRecent(event.newValue);
      listeners.forEach((listener) => listener());
    });
  }
  return recent;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useRecentOrder = () => useSyncExternalStore(subscribe, load, () => null);

/**
 * Remembers a paid order, unless a later one is remembered already (an old receipt's link opened
 * again). A staff test order is never remembered: it is not something to order again.
 */
export function rememberOrder(order: {id: string; code: string; pickupAt: string; items: readonly CartLine[]}) {
  if (order.items.some((item) => item.dishId === TEST_DISH.id)) return;
  const known = load();
  if (known && (known.id === order.id || Date.parse(known.pickupAt) > Date.parse(order.pickupAt))) return;
  const next: RecentOrder = {id: order.id, code: order.code, pickupAt: order.pickupAt, lines: order.items.map(({dishId, quantity}) => ({dishId, quantity}))};
  window.localStorage.setItem(KEY, JSON.stringify(next));
  recent = parseRecent(JSON.stringify(next));
  listeners.forEach((listener) => listener());
}

/** What of an earlier order can be ordered again right now: dishes still on the menu and not sold out, nothing while orders are paused. */
export function orderAgainLines(lines: readonly CartLine[], {ordersPaused, soldOut}: Availability): CartLine[] {
  if (ordersPaused) return [];
  return parseLines(lines).filter((line) => line.dishId !== TEST_DISH.id && !soldOut[line.dishId]);
}
