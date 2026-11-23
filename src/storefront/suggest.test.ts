import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import {suggestionsFor} from './suggest';

const ids = (dishes: readonly {id: string}[]) => dishes.map((dish) => dish.id);
const always = () => true;

describe('suggestionsFor', () => {
  it('offers one dish per kind the bag lacks, best sellers first', () => {
    const picked = suggestionsFor(storefront, [{dishId: 'indulgent-iceberg-cheesecake', quantity: 1}], always);
    expect(ids(picked)).toEqual(['shio-pan', 'dubai-chewy-cookie', 'matcha-strawberry']);
  });

  it('offers only add-ons, never a kind the bag has already or a dish with limited hours', () => {
    const picked = suggestionsFor(storefront, [{dishId: 'latte', quantity: 1}, {dishId: 'croissant', quantity: 1}], always, 10);
    expect(ids(picked)).toEqual(['london-to-shah-alam', 'dubai-chewy-cookie']);
  });

  it('names only categories that exist as add-ons', () => {
    const categories = new Set(storefront.categories.map((category) => category.id));
    expect(storefront.addOns.filter((id) => !categories.has(id))).toEqual([]);
  });

  it('skips a dish that is not on offer and takes the next of its kind', () => {
    const picked = suggestionsFor(storefront, [{dishId: 'latte', quantity: 1}], (id) => id !== 'london-to-shah-alam');
    expect(ids(picked)).toEqual(['shio-pan', 'dubai-chewy-cookie', 'indulgent-iceberg-cheesecake']);
  });
});
