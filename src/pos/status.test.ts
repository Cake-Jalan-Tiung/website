import {describe, expect, it} from 'vitest';
import {TEST_DISH} from '../orders/model';
import {POS_STUCK_MINUTES, posState, posSyncOn} from './status';

const now = new Date('2026-11-23T10:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const croissant = [{dishId: 'croissant', name: 'Croissant', unitSen: 900, quantity: 1}];

describe('posState', () => {
  it('is recorded once StoreHub has the sale', () => {
    expect(posState({items: croissant, paidAt: minutesAgo(30), posRecordedAt: minutesAgo(25)}, now)).toBe('recorded');
  });

  it('is on its way for the first two cron runs, then stuck', () => {
    expect(posState({items: croissant, paidAt: minutesAgo(1), posRecordedAt: null}, now)).toBe('sending');
    expect(posState({items: croissant, paidAt: minutesAgo(POS_STUCK_MINUTES - 1), posRecordedAt: null}, now)).toBe('sending');
    expect(posState({items: croissant, paidAt: minutesAgo(POS_STUCK_MINUTES + 1), posRecordedAt: null}, now)).toBe('stuck');
  });

  it('never counts a staff test order as a sale', () => {
    const test = [{dishId: TEST_DISH.id, name: TEST_DISH.name, unitSen: 100, quantity: 1}];
    expect(posState({items: test, paidAt: minutesAgo(60), posRecordedAt: null}, now)).toBe('not-a-sale');
  });
});

describe('posSyncOn', () => {
  it('sends sales only on real payments', () => {
    expect(posSyncOn('chip')).toBe(true);
    expect(posSyncOn('fake')).toBe(false);
    expect(posSyncOn('')).toBe(false);
  });
});
