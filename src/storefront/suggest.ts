// What to offer beside a bag before paying: one dish from each of the shop's add-on categories
// the bag does not have yet (a drink beside a slice, a slice beside a drink), best sellers first.
// Only dishes served all day are offered, so a suggestion never narrows the pick-up times.
import type {CartLine} from '../orders/model';
import {allDishes, dishIndex, type Dish, type Storefront} from './model';

export function suggestionsFor(store: Storefront, lines: readonly CartLine[], isOffered: (dishId: string) => boolean, limit = 3): Dish[] {
  const categoryOf = new Map(store.categories.flatMap((category) => category.dishes.map((dish) => [dish.id, category] as const)));
  const taken = new Set(lines.map((line) => categoryOf.get(line.dishId)?.id));
  const ranked = new Set([...store.bestSellers, ...allDishes(store).map((dish) => dish.id)]);
  const picked: Dish[] = [];
  for (const id of ranked) {
    const category = categoryOf.get(id);
    const dish = dishIndex(store).get(id);
    if (!category || !dish || !store.addOns.includes(category.id) || category.servedBetween || taken.has(category.id) || !isOffered(id)) continue;
    taken.add(category.id);
    picked.push(dish);
    if (picked.length === limit) break;
  }
  return picked;
}
