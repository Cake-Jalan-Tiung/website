// The bag's controls: Add on every dish, a stepper once it is in the bag, the header button,
// and the bar that follows the customer down the page while the bag has something in it.
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {bag, countOf, useBag, useBagQuantity} from '../orders/bag';
import {useAvailability} from '../orders/availability-store';
import {MAX_QUANTITY, formatRM, priceCart} from '../orders/model';
import {Type} from '../system/Type';
import type {Dish, Storefront} from './model';
import s from './storefront.module.css';

/** Add, or − n + once the dish is in the bag; Sold out while staff have it closed. */
export function AddToBag({dish}: {dish: Dish}) {
  const quantity = useBagQuantity(dish.id);
  const {ordersPaused, soldOut} = useAvailability();
  if (quantity === 0) {
    if (soldOut[dish.id]) return <Button variant="secondary" size="sm" label={`${dish.name} is sold out`} isDisabled>Sold out</Button>;
    return <Button variant="secondary" size="sm" label={`Add ${dish.name} to bag`} onClick={() => bag.add(dish.id)} isDisabled={ordersPaused !== null}>Add</Button>;
  }
  return (
    <span className={s.stepper} role="group" aria-label={`${dish.name} in bag`}>
      <Button variant="secondary" size="sm" isIconOnly icon={<span aria-hidden>−</span>} label={`One less ${dish.name}`} onClick={() => bag.set(dish.id, quantity - 1)} />
      <span className={s.stepperCount} aria-live="polite">
        <Type role="body">{quantity}</Type>
      </span>
      <Button variant="secondary" size="sm" isIconOnly icon={<span aria-hidden>+</span>} label={`One more ${dish.name}`} onClick={() => bag.add(dish.id)} isDisabled={quantity >= MAX_QUANTITY} />
    </span>
  );
}

/** Under the header while staff have paused online orders. */
export function PausedNotice() {
  const {ordersPaused} = useAvailability();
  if (!ordersPaused) return null;
  const when = ordersPaused.until ? 'today' : 'for now';
  return <Banner status="warning" title={`Online orders are paused ${when}.`} description="You are welcome to order at the counter." />;
}

/** The header's action: Order now (the menu) while the bag is empty, then the bag and its count. */
export function BagButton({store}: {store: Storefront}) {
  const count = countOf(useBag());
  return count === 0 ? (
    <Button variant="primary" label="Order now" href={store.menu.href} />
  ) : (
    <Button variant="primary" label={`Bag, ${count} ${count === 1 ? 'item' : 'items'}`} href="/checkout">{`Bag · ${count}`}</Button>
  );
}

/** Follows the page while the bag has something in it: count, total, Checkout. */
export function BagBar({store}: {store: Storefront}) {
  const lines = useBag();
  if (lines.length === 0) return null;
  // Display only: the server prices the cart again and decides who may order the test item.
  const {totalSen} = priceCart(store, lines, {allowTest: true});
  const count = countOf(lines);
  return (
    <aside className={s.bagBar} aria-label="Your bag">
      <span className={s.bagBarInner}>
        <Type role="body">
          {count} {count === 1 ? 'item' : 'items'} · {formatRM(totalSen)}
        </Type>
        <Button variant="primary" size="lg" label="Checkout" href="/checkout" />
      </span>
    </aside>
  );
}
