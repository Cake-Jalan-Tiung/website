import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import {suggestionsFor} from './suggest';

const ids = (dishes: readonly {id: string}[]) => dishes.map((dish) => dish.id);
const always = () => true;

describe('suggestionsFor', () => {
  it('offers one dish per add-on kind the bag lacks, a drink first, best sellers first within a kind', () => {
    const picked = suggestionsFor(storefront, [{dishId: 'chicken-carbonara', quantity: 1}], always);
    expect(ids(picked)).toEqual(['matcha-strawberry', 'shio-pan', 'dubai-chewy-cookie']);
  });

  it('offers only add-ons, never a kind the bag has already or a dish with limited hours', () => {
    const picked = suggestionsFor(storefront, [{dishId: 'latte', quantity: 1}, {dishId: 'croissant', quantity: 1}], always, 10);
    expect(ids(picked)).toEqual(['dubai-chewy-cookie', 'london-to-shah-alam']);
  });

  it('skips a dish that is not on offer and takes the next of its kind', () => {
    const picked = suggestionsFor(storefront, [{dishId: 'latte', quantity: 1}], (id) => id !== 'shio-pan');
    expect(ids(picked)).toEqual(['strawberry-cream-cheese-danish', 'dubai-chewy-cookie', 'london-to-shah-alam']);
  });

  it('names only categories that exist as add-ons', () => {
    const categories = new Set(storefront.categories.map((category) => category.id));
    expect(storefront.addOns.filter((id) => !categories.has(id))).toEqual([]);
  });
});
