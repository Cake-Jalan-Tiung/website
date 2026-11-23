// What to offer beside a bag before paying: one dish from each of the shop's add-on categories
// the bag does not have yet, in the order the shop lists them (a drink first), each category's
// best seller before the rest. Only dishes served all day are offered, so a suggestion never
// narrows the pick-up times.
import type {CartLine} from '../orders/model';
import type {Dish, Storefront} from './model';

export function suggestionsFor(store: Storefront, lines: readonly CartLine[], isOffered: (dishId: string) => boolean, limit = 3): Dish[] {
  const inBag = new Set(lines.map((line) => line.dishId));
  const rank = (dish: Dish) => {
    const at = store.bestSellers.indexOf(dish.id);
    return at === -1 ? store.bestSellers.length : at;
  };
  return store.addOns
    .flatMap((id) => store.categories.filter((category) => category.id === id))
    .filter((category) => !category.servedBetween && !category.dishes.some((dish) => inBag.has(dish.id)))
    .flatMap((category) => {
      const [first] = category.dishes.filter((dish) => isOffered(dish.id)).sort((a, b) => rank(a) - rank(b));
      return first ? [first] : [];
    })
    .slice(0, limit);
}
