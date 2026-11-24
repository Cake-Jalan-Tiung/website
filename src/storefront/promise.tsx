// Whether the shop is open and the soonest pick-up, told before checkout: on the menu, under the
// hero's action and on the bag bar, where it follows what is in the bag (breakfast only in the morning).
import type {CartLine} from '../orders/model';
import {servingWindow} from '../orders/model';
import {pickupPromise} from '../orders/pickup';
import {useAvailability} from '../orders/availability-store';
import {Type} from '../system/Type';
import type {Storefront} from './model';
import {useNow} from './now';
import s from './storefront.module.css';

export function usePickupPromise(store: Storefront, lines?: readonly CartLine[]) {
  const now = useNow();
  const {ordersPaused} = useAvailability();
  if (!now || ordersPaused) return null;
  return pickupPromise(store, now, lines ? servingWindow(store, lines)?.span : undefined);
}

/** Said wherever an order would start while staff have paused online orders. */
export const PAUSED = 'Online orders are paused. You can still order at the counter.';

/** "Open now · Pick-up today from 2:30pm". */
export const promiseLine = (promise: NonNullable<ReturnType<typeof usePickupPromise>>) => `${promise.isOpen ? 'Open now' : 'Closed now'} · ${promise.soonest}`;

/** One line, "Open now · Pick-up today from 2:30pm", or why online orders are paused. It holds its line while the page wakes, so nothing below it moves. */
export function PickupPromise({store}: {store: Storefront}) {
  const promise = usePickupPromise(store);
  const {ordersPaused} = useAvailability();
  if (ordersPaused) {
    return (
      <span className={s.promise} data-shown="">
        <Type role="body">{PAUSED}</Type>
      </span>
    );
  }
  return (
    <span className={s.promise} data-open={promise?.isOpen ? '' : undefined} data-shown={promise ? '' : undefined}>
      <Type role="body">{promise ? promiseLine(promise) : ' '}</Type>
    </span>
  );
}
