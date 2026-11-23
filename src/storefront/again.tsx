// A returning customer's way back, under the header on every browsing page. While their last
// order is in the kitchen it leads to that order's page; once it is done, the same order goes
// back into the bag in one tap and checkout opens.
import {useEffect, useState, type ReactNode} from 'react';
import {bag} from '../orders/bag';
import {settlePaying} from '../orders/settle';
import {useAvailability} from '../orders/availability-store';
import {getOrder, type PublicOrder} from '../orders/functions';
import {CUSTOMER_STEPS, customerCopy, formatRM, isFinished, orderableDish} from '../orders/model';
import {orderAgainLines, useRecentOrder, type RecentOrder} from '../orders/recent';
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
  // Each answer is kept with the order it is about, so a newer order never shows an older one's status.
  const [answer, setAnswer] = useState<{id: string; order: PublicOrder | null} | null>(null);
  const id = recent?.id;
  // Long past its pick-up, the order needs no asking: Order again shows at once, with no jump.
  const past = recent !== null && Date.now() > Date.parse(recent.pickupAt) + TRACK_HOURS * 3_600_000;
  useEffect(() => {
    if (!id || past) return;
    let live = true;
    getOrder({data: {id}}).then(
      (order) => live && setAnswer({id, order: order && isTracked(order, Date.now()) ? order : null}),
      () => live && setAnswer({id, order: null}),
    );
    return () => {
      live = false;
    };
  }, [id, past]);
  if (past) return null;
  return answer && answer.id === id ? answer.order : undefined;
}

/** Settles payments that never came back to their page, once per page and again when it returns to view. */
function useSettlePaying() {
  useEffect(() => {
    const settle = () => void settlePaying();
    settle();
    const onVisible = () => document.visibilityState === 'visible' && settle();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}

function Strip({children}: {children: ReactNode}) {
  return (
    <Field as="section" colour="blue-50" outlined={false} aria-label="Your last order" className={s.again}>
      <span className={s.againInner}>{children}</span>
    </Field>
  );
}

export function LastOrder({store}: {store: Storefront}) {
  useSettlePaying();
  const recent = useRecentOrder();
  const tracked = useTracked(recent);
  const availability = useAvailability();
  if (!recent) return null;

  // While its status is asked for, the strip already stands, from what this device remembers,
  // so the page under it does not jump when the answer comes.
  if (tracked || tracked === undefined) {
    return (
      <Strip>
        <a href={`/order/${recent.id}`} className={s.againTrack} aria-busy={tracked === undefined || undefined}>
          <span className={s.againText}>
            <Label ink="secondary">Order {recent.code}</Label>
            <Type role="body" className={s.againTitle}>{tracked ? customerCopy(tracked.status).title : '\u00a0'}</Type>
            <Type role="caption" ink="secondary">Pick-up {formatShopTime(store.timeZone, recent.pickupAt)}</Type>
          </span>
          <Label ink="blue">Track →</Label>
        </a>
      </Strip>
    );
  }

  const lines = orderAgainLines(recent.lines, availability);
  if (lines.length === 0) return null;
  const left = recent.lines.flatMap((line) => (lines.some((kept) => kept.dishId === line.dishId) ? [] : (orderableDish(store, line.dishId)?.name ?? [])));
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
        {left.length > 0 ? <Type role="caption" ink="secondary">Sold out today: {left.join(', ')}</Type> : null}
      </span>
      <button
        type="button"
        className={s.againButton}
        aria-label={`Order again: ${summary}, ${formatRM(totalSen)}`}
        onClick={() => {
          bag.include(lines);
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
