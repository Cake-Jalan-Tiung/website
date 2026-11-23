import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import {CartError, PAYMENT_WINDOW_MINUTES, TEST_DISH, canMove, customerProblems, isFinished, parseCustomer, priceCart, servingWindow} from './model';
import {parseBag} from './bag';
import {isOpenSlot, pickupPromise, pickupSlots} from './pickup';
import {parseRecent} from './recent';

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

  it('refunds a collected order, which the customer page still treats as finished', () => {
    expect(canMove('collected', 'refunded')).toBe(true);
    expect(isFinished('collected')).toBe(true);
    expect(isFinished('refunded')).toBe(true);
    expect(isFinished('ready')).toBe(false);
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

describe('pickupPromise', () => {
  it('says the shop is open and the soonest time today', () => {
    // Wednesday 25 Nov 2026, 2:05pm in Kuala Lumpur.
    expect(pickupPromise(storefront, new Date('2026-11-25T06:05:00Z'))).toEqual({isOpen: true, soonest: 'Pick-up today from 2:30pm'});
  });

  it('says closed, and names the next open day, across the closed Thursday', () => {
    // Wednesday 25 Nov 2026, 11pm.
    expect(pickupPromise(storefront, new Date('2026-11-25T15:00:00Z'))).toEqual({isOpen: false, soonest: 'Pick-up Fri 27 Nov from 8am'});
  });

  it('says tomorrow before opening the next morning', () => {
    // Monday 23 Nov 2026, 10pm.
    expect(pickupPromise(storefront, new Date('2026-11-23T14:00:00Z'))?.soonest).toBe('Pick-up tomorrow from 8am');
  });

  it('follows a bag that can only be collected in the morning', () => {
    const window = servingWindow(storefront, [{dishId: 'classic-big-breakfast', quantity: 1}]);
    expect(pickupPromise(storefront, new Date('2026-11-25T06:05:00Z'), window?.span)?.soonest).toBe('Pick-up Fri 27 Nov from 8:30am');
  });
});

describe('parseRecent', () => {
  const order = {id: '1e5446e5-b8ee', code: '1E5446', pickupAt: '2026-11-25T06:30:00.000Z'};

  it('keeps an order with lines still on the menu', () => {
    const lines = [{dishId: 'shio-pan', quantity: 2}, {dishId: 'gone', quantity: 1}];
    expect(parseRecent(JSON.stringify({...order, lines}))).toEqual({...order, lines: [{dishId: 'shio-pan', quantity: 2}]});
  });

  it('forgets an order with nothing left to order again, the staff test order, or garbage', () => {
    expect(parseRecent(JSON.stringify({...order, lines: [{dishId: 'gone', quantity: 1}]}))).toBeNull();
    expect(parseRecent(JSON.stringify({...order, lines: [{dishId: TEST_DISH.id, quantity: 1}]}))).toBeNull();
    expect(parseRecent(JSON.stringify({...order, pickupAt: 'soon', lines: [{dishId: 'shio-pan', quantity: 1}]}))).toBeNull();
    expect(parseRecent('not json')).toBeNull();
    expect(parseRecent(null)).toBeNull();
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

describe('customerProblems', () => {
  const good = {name: 'Aina', phone: '012-345 6789', email: 'aina@example.com'};
  it('finds nothing wrong with good details', () => {
    expect(customerProblems(good)).toEqual({});
  });
  it('names only the fields that need a fix, each in its own words', () => {
    expect(customerProblems({...good, email: ''})).toEqual({email: 'Enter an email for your receipt.'});
    expect(customerProblems({...good, email: 'aina@'})).toEqual({email: 'Enter an email like name@example.com.'});
    expect(customerProblems({...good, name: 'x'.repeat(61)})).toEqual({name: 'Use a name of 60 characters or fewer.'});
    expect(Object.keys(customerProblems({}))).toEqual(['name', 'phone', 'email']);
  });
  it('is what the server refuses with', () => {
    expect(() => parseCustomer({...good, phone: '123'})).toThrow('Enter a Malaysian mobile number, like 012-345 6789.');
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

describe('the staff test order', () => {
  const test = [{dishId: TEST_DISH.id, quantity: 1}];

  it('costs RM 1 for signed-in staff', () => {
    expect(priceCart(storefront, test, {allowTest: true}).totalSen).toBe(100);
  });

  it('is refused for anyone else', () => {
    expect(() => priceCart(storefront, test)).toThrow(CartError);
  });

  it('cannot share a cart with real dishes', () => {
    expect(() => priceCart(storefront, [...test, {dishId: 'croissant', quantity: 1}], {allowTest: true})).toThrow(CartError);
  });

  it('is on no menu', () => {
    expect(storefront.categories.some((category) => category.dishes.some((dish) => dish.id === TEST_DISH.id))).toBe(false);
  });
});
