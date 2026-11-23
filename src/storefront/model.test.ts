import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import {allDishes, dishesById} from './model';

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

  it('prices every dish in whole sen', () => {
    for (const dish of dishes) expect(Math.round(dish.price * 100)).toBeCloseTo(dish.price * 100, 6);
  });

  it('gives every category a dish and a unique id', () => {
    const ids = storefront.categories.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of storefront.categories) expect(category.dishes.length).toBeGreaterThan(0);
  });
});
