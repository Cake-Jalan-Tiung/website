import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import {CartError, PAYMENT_WINDOW_MINUTES, canMove, parseCustomer, priceCart, servingWindow} from './model';
import {parseBag} from './bag';
import {isOpenSlot, pickupSlots} from './pickup';

describe('priceCart', () => {
  it('prices from the catalogue in sen', () => {
    const cart = priceCart(storefront, [{dishId: 'iced-ajisai-matcha-latte', quantity: 2}, {dishId: 'shio-pan', quantity: 1}]);
    expect(cart.lines[0].unitSen).toBe(1950);
    expect(cart.totalSen).toBe(1950 * 2 + cart.lines[1].unitSen);
  });

  it.each([
    [[]],
    [[{dishId: 'not-a-dish', quantity: 1}]],
    [[{dishId: 'shio-pan', quantity: 0}]],
    [[{dishId: 'shio-pan', quantity: 1.5}]],
    [[{dishId: 'shio-pan', quantity: 21}]],
    [[{dishId: 'shio-pan', quantity: 1}, {dishId: 'shio-pan', quantity: 1}]],
  ])('refuses %j', (cart) => {
    expect(() => priceCart(storefront, cart)).toThrow(CartError);
  });
});

describe('order status', () => {
  it('only moves forward', () => {
    expect(canMove('awaiting_payment', 'paid')).toBe(true);
    expect(canMove('paid', 'paid')).toBe(false);
    expect(canMove('collected', 'ready')).toBe(false);
  });

  it('honours money that arrives after an order expired or a payment attempt failed', () => {
    expect(canMove('expired', 'paid')).toBe(true);
    expect(canMove('cancelled', 'paid')).toBe(true);
    expect(canMove('refunded', 'paid')).toBe(false);
  });
});

describe('pickupSlots', () => {
  // Wednesday 25 Nov 2026, 5:15pm in Kuala Lumpur.
  const wednesdayEvening = new Date('2026-11-25T09:15:00Z');

  it('starts after the lead time and stops a slot before closing', () => {
    const today = pickupSlots(storefront, wednesdayEvening).filter((slot) => slot.day === 'Today');
    expect(today.map((slot) => slot.time)).toEqual(['5:45pm']);
  });

  it('skips the closed day', () => {
    const days = new Set(pickupSlots(storefront, wednesdayEvening).map((slot) => slot.day));
    expect(days).toEqual(new Set(['Today', 'Fri 27 Nov']));
  });

  it('keeps breakfast inside its window', () => {
    const window = servingWindow(storefront, [{dishId: 'classic-big-breakfast', quantity: 1}]);
    const times = pickupSlots(storefront, wednesdayEvening, window?.span).map((slot) => slot.time);
    expect(window?.categories).toEqual(['Breakfast']);
    expect(times[0]).toBe('8:30am');
    expect(times.at(-1)).toBe('11:45am');
  });

  it('accepts only offered slots', () => {
    const [first] = pickupSlots(storefront, wednesdayEvening);
    expect(isOpenSlot(storefront, wednesdayEvening, first.at)).toBe(true);
    expect(isOpenSlot(storefront, wednesdayEvening, '2026-11-26T03:00:00.000Z')).toBe(false);
  });
});

describe('parseCustomer', () => {
  it('normalises Malaysian mobiles', () => {
    for (const phone of ['012-345 6789', '+60123456789', '60123456789', '0112345 6789']) {
      expect(parseCustomer({name: 'Aina', phone, email: 'a@b.my'}).phone).toMatch(/^\+601\d{8,9}$/);
    }
  });

  it.each([
    [{name: '', phone: '0123456789', email: 'a@b.my'}],
    [{name: 'Aina', phone: '03-1234 5678', email: 'a@b.my'}],
    [{name: 'Aina', phone: '0123456789', email: 'nope'}],
  ])('refuses %j', (input) => {
    expect(() => parseCustomer(input)).toThrow(CartError);
  });
});

describe('payment window', () => {
  it('closes before the earliest pick-up time, so a paid order is never already late', () => {
    expect(PAYMENT_WINDOW_MINUTES).toBeLessThan(storefront.pickup.leadMinutes);
  });
});

describe('parseBag', () => {
  it('keeps only dishes still on the menu, once each, with sane quantities', () => {
    const stored = JSON.stringify([
      {dishId: 'gone', quantity: 1},
      {dishId: 'shio-pan', quantity: 2},
      {dishId: 'shio-pan', quantity: 5},
      {dishId: 'croissant', quantity: 1.5},
      {dishId: 'butter-tteok', quantity: 99},
    ]);
    expect(parseBag(stored)).toEqual([{dishId: 'shio-pan', quantity: 2}, {dishId: 'butter-tteok', quantity: 20}]);
  });

  it('reads garbage as an empty bag', () => {
    expect(parseBag('not json')).toEqual([]);
    expect(parseBag('{"a":1}')).toEqual([]);
  });
});
