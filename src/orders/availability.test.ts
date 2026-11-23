import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import {OPEN, assertAvailable, availabilityFrom, closureEnds, dishSubject} from './availability';
import {CartError, TEST_DISH} from './model';

// 10pm on Monday 23 November in Shah Alam (UTC+8).
const now = new Date('2026-11-23T14:00:00Z');

describe('availabilityFrom', () => {
  it('reads a pause and sold-out dishes, and drops closures that have ended', () => {
    const availability = availabilityFrom(
      [
        {subject: 'orders', until: null},
        {subject: dishSubject('croissant'), until: '2026-11-23T16:00:00Z'},
        {subject: dishSubject('shio-pan'), until: '2026-11-23T13:00:00Z'},
      ],
      now,
    );
    expect(availability).toEqual({ordersPaused: {until: null}, soldOut: {croissant: {until: '2026-11-23T16:00:00Z'}}});
  });
});

describe('closureEnds', () => {
  it('ends "today" at the start of the next shop day, not the next UTC day', () => {
    expect(closureEnds(storefront, 'today', now)).toBe('2026-11-23T16:00:00.000Z');
  });

  it('keeps "until reopened" open-ended', () => {
    expect(closureEnds(storefront, 'until-reopened', now)).toBeNull();
  });
});

describe('assertAvailable', () => {
  const croissant = [{dishId: 'croissant', quantity: 1}];

  it('lets an order through when nothing is closed', () => {
    expect(() => assertAvailable(storefront, croissant, OPEN)).not.toThrow();
  });

  it('refuses every order while online ordering is paused', () => {
    expect(() => assertAvailable(storefront, croissant, {...OPEN, ordersPaused: {until: null}})).toThrow(CartError);
  });

  it('names the sold-out dish', () => {
    expect(() => assertAvailable(storefront, croissant, {...OPEN, soldOut: {croissant: {until: null}}})).toThrow(/Croissant is sold out/);
  });

  it('still lets staff place a test order while paused', () => {
    expect(() => assertAvailable(storefront, [{dishId: TEST_DISH.id, quantity: 1}], {...OPEN, ordersPaused: {until: null}})).not.toThrow();
  });
});
