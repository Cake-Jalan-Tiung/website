import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import {allDishes, dishesById} from './model';
import {formatSpan, shopClock, shopInstant} from './hours';

describe('storefront content', () => {
  const dishes = allDishes(storefront);

  it('gives every dish its own id', () => {
    const ids = dishes.map((dish) => dish.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names only dishes that exist as best sellers and in season', () => {
    expect(() => dishesById(storefront, storefront.bestSellers)).not.toThrow();
    if (storefront.inSeason) expect(() => dishesById(storefront, [storefront.inSeason!.dishId])).not.toThrow();
  });

  it('borrows photos only from dishes that exist', () => {
    const covers = [storefront.heroCover, ...storefront.categories.map((category) => category.cover)].filter((id): id is string => id !== undefined);
    expect(() => dishesById(storefront, covers)).not.toThrow();
  });

  it('puts only dishes with a drawing on the counter', () => {
    const dishes = dishesById(storefront, storefront.counter?.dishes ?? []);
    expect(dishes.filter((dish) => !dish.drawing).map((dish) => dish.id)).toEqual([]);
  });
  it('prices every dish in whole sen', () => {
    for (const dish of dishes) expect(Math.round(dish.price * 100)).toBeCloseTo(dish.price * 100, 6);
  });

  it('gives every category a dish and a unique id', () => {
    const ids = storefront.categories.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of storefront.categories) expect(category.dishes.length).toBeGreaterThan(0);
  });
});

describe('shopClock', () => {
  it('reads the day in the shop time zone, not the server one', () => {
    // 20:00 UTC on Wednesday 25 Nov 2026 is 04:00 Thursday in Kuala Lumpur.
    const clock = shopClock('Asia/Kuala_Lumpur', new Date('2026-11-25T20:00:00Z'));
    expect(clock).toEqual({dayIndex: 3, year: 2026, month: 11, day: 26, minutes: 240});
  });

  it('turns a shop wall-clock time back into the instant', () => {
    expect(shopInstant('Asia/Kuala_Lumpur', {year: 2026, month: 11, day: 26}, 8 * 60).toISOString()).toBe('2026-11-26T00:00:00.000Z');
  });

  it('formats spans the way the shop writes them', () => {
    expect(formatSpan(['08:30', '12:00'])).toBe('8:30am – 12pm');
    expect(formatSpan(['08:00', '18:00'])).toBe('8am – 6pm');
  });
});
