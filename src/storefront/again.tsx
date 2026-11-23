// A returning customer's way back, under the header on every browsing page. While their last
// order is in the kitchen it leads to that order's page; once it is done, the same order goes
// back into the bag in one tap and checkout opens.
import {useEffect, useState, type ReactNode} from 'react';
import {bag} from '../orders/bag';
import {useAvailability} from '../orders/availability-store';
import {getOrder, type PublicOrder} from '../orders/functions';
import {CUSTOMER_STEPS, customerCopy, formatRM, isFinished, orderableDish, type CartLine} from '../orders/model';
import {useRecentOrder, type RecentOrder} from '../orders/recent';
import {Label} from '../system/components';
import {Field} from '../system/Field';
import {Type} from '../system/Type';
import {formatShopTime} from './hours';
import type {Storefront} from './model';
import s from './storefront.module.css';

/** After its pick-up time by this much, an order is done whatever the board says: nobody tracks yesterday's cake. */
const TRACK_HOURS = 12;

const isTracked = (order: PublicOrder, now: number) =>
  !isFinished(order.status) && CUSTOMER_STEPS.some((step) => step.status === order.status) && now < Date.parse(order.pickupAt) + TRACK_HOURS * 3_600_000;

/** How the last order stands: undefined while asking, null once there is nothing to track. */
function useTracked(recent: RecentOrder | null) {
  const [tracked, setTracked] = useState<PublicOrder | null | undefined>(undefined);
  const id = recent?.id;
  const pickupAt = recent?.pickupAt;
  useEffect(() => {
    if (!id || !pickupAt) return;
    if (Date.now() > Date.parse(pickupAt) + TRACK_HOURS * 3_600_000) return setTracked(null);
    let live = true;
    getOrder({data: {id}}).then(
      (order) => live && setTracked(order && isTracked(order, Date.now()) ? order : null),
      () => live && setTracked(null),
    );
    return () => {
      live = false;
    };
  }, [id, pickupAt]);
  return tracked;
}

function Strip({children}: {children: ReactNode}) {
  return (
    <Field as="section" colour="blue-50" outlined={false} aria-label="Your last order" className={s.again}>
      <span className={s.againInner}>{children}</span>
    </Field>
  );
}

export function LastOrder({store}: {store: Storefront}) {
  const recent = useRecentOrder();
  const tracked = useTracked(recent);
  const {ordersPaused, soldOut} = useAvailability();
  if (!recent || tracked === undefined) return null;

  if (tracked) {
    return (
      <Strip>
        <a href={`/order/${tracked.id}`} className={s.againTrack}>
          <span className={s.againText}>
            <Label ink="secondary">Order {tracked.code}</Label>
            <Type role="body" className={s.againTitle}>{customerCopy(tracked.status).title}</Type>
            <Type role="caption" ink="secondary">Pick-up {formatShopTime(store.timeZone, tracked.pickupAt)}</Type>
          </span>
          <Label ink="blue">Track →</Label>
        </a>
      </Strip>
    );
  }

  const lines: CartLine[] = recent.lines.filter((line) => !soldOut[line.dishId]);
  if (ordersPaused || lines.length === 0) return null;
  const named = lines.flatMap((line) => {
    const dish = orderableDish(store, line.dishId);
    return dish ? [{...line, dish}] : [];
  });
  const totalSen = named.reduce((sum, line) => sum + Math.round(line.dish.price * 100) * line.quantity, 0);
  const summary = named.map((line) => (line.quantity > 1 ? `${line.quantity} × ${line.dish.name}` : line.dish.name)).join(', ');
  return (
    <Strip>
      <span className={s.againText}>
        <Label ink="secondary">Your last order</Label>
        <span className={s.againSummary} data-fit="clips">
          <Type role="body">{summary}</Type>
        </span>
      </span>
      <button
        type="button"
        className={s.againButton}
        aria-label={`Order again: ${summary}, ${formatRM(totalSen)}`}
        onClick={() => {
          bag.addAll(lines);
          window.location.assign('/checkout');
        }}
      >
        <Field as="span" colour="blue" outlined={false} className={s.againFace}>
          <Type role="body" className={s.againTitle}>Order again · {formatRM(totalSen)}</Type>
        </Field>
      </button>
    </Strip>
  );
}
