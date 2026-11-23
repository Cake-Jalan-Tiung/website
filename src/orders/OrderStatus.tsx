// The customer's order after paying: a field in the colour of where it is, its code as big as
// the page allows, the steps behind it, then when and where to collect and what is in it. It
// follows the order by itself until it is finished.
import {useEffect, useRef, useState} from 'react';
import {Link} from '@astryxdesign/core/Link';
import {storefront} from '../site/content';
import {Cta} from '../storefront/bag';
import {StoreHeader} from '../storefront/sections';
import {Field} from '../system/Field';
import {Label} from '../system/components';
import type {Ground} from '../system/model';
import {Page, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {bag, settleBag} from './bag';
import {useAvailability} from './availability-store';
import {OrderTotal} from './Checkout';
import {arriveForOrder, getOrder, type PublicOrder} from './functions';
import {CUSTOMER_STEPS, arrivalOpensAt, canArrive, customerCopy, formatRM, isDormant, isFinished, type OrderStatus} from './model';
import {formatShopTime} from '../storefront/hours';
import {orderAgainLines, rememberOrder} from './recent';
import {useNow} from '../storefront/now';
import s from './orders.module.css';

const POLL_MS = 4000;
/** Expired and cancelled orders are checked only now and then, for a late payment. */
const DORMANT_POLL_MS = 60_000;

/**
 * Ready is the moment the customer is waiting for, so it is the one status on cobalt; the kitchen
 * steps before it are its pale wash. Cream-400 is avoided: it reads as the warning banner's colour.
 */
const GROUND: Record<OrderStatus, Exclude<Ground, 'paper'>> = {
  awaiting_payment: 'cream-100',
  paid: 'blue-50',
  accepted: 'blue-50',
  ready: 'blue',
  collected: 'cream-100',
  expired: 'chalk',
  cancelled: 'chalk',
  refunded: 'chalk',
};

export function OrderStatusPage({initial}: {initial: PublicOrder}) {
  const [order, setOrder] = useState(initial);
  const finished = isFinished(order.status);

  useEffect(() => {
    if (finished) return;
    const timer = window.setInterval(() => {
      // A poll sent before I'm here can land after it; what the customer has said stays said.
      getOrder({data: {id: order.id}}).then((next) => next && setOrder((was) => ({...next, arrivedAt: next.arrivedAt ?? was.arrivedAt})));
    }, isDormant(order.status) ? DORMANT_POLL_MS : POLL_MS);
    return () => window.clearInterval(timer);
  }, [order.id, order.status, finished]);

  const reached = CUSTOMER_STEPS.findIndex((step) => step.status === order.status);
  const inKitchen = reached >= 0;
  // Once the money is in, the bag that paid for it has done its job, and the order is one to come back to.
  useEffect(() => {
    if (!inKitchen) return;
    rememberOrder(order, settleBag(order.id));
    // The order's id, code, pick-up and items never change, so its first paid sighting is the one that counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inKitchen, order.id]);
  const availability = useAvailability();
  const again = orderAgainLines(order.items, availability);

  const copy = customerCopy(order.status);
  // The tab's title says where the order is, so a glance at the tabs answers "is it ready?".
  useEffect(() => {
    document.title = `${copy.title} · ${order.code} — ${storefront.name}`;
  }, [copy.title, order.code]);
  // Ready is the moment the customer waits for: a phone that can buzz, buzzes once.
  const was = useRef(order.status);
  useEffect(() => {
    if (order.status === 'ready' && was.current !== 'ready') navigator.vibrate?.([120, 80, 120]);
    was.current = order.status;
  }, [order.status]);

  const ground = GROUND[order.status];
  const retry = isDormant(order.status);

  return (
    <Page top={<StoreHeader store={storefront} mode="focus" />}>
      <Field colour={ground} outlined={false} className={s.ticket} data-ground={ground}>
        <div className={s.ticketInner}>
          <Stack gap="xs">
            <Label ink="secondary">Order · {order.firstName}</Label>
            <Type role="display" as="p" className={s.bigCode}>{order.code}</Type>
          </Stack>
          <Stack gap="xs">
            <Type role="head" as="h1" aria-live="polite">{copy.title}</Type>
            <Type role="body" as="p">{copy.line}</Type>
            {inKitchen && !finished ? (
              <span className={s.live}>
                <Type role="caption" ink="secondary">Updates by itself</Type>
              </span>
            ) : null}
          </Stack>
          {inKitchen ? (
            <ol className={s.progress} aria-label="Progress">
              {CUSTOMER_STEPS.map((step, index) => (
                <li key={step.status} data-done={index <= reached ? '' : undefined} aria-current={index === reached ? 'step' : undefined}>
                  <Type role="caption">{step.label}</Type>
                </li>
              ))}
            </ol>
          ) : null}
          {inKitchen && !finished ? <Arrival order={order} onArrived={setOrder} /> : null}
          {order.status === 'collected' && again.length > 0 ? (
            <Cta
              onClick={() => {
                bag.include(again);
                window.location.assign('/checkout');
              }}
            >
              Order the same again
            </Cta>
          ) : null}
          {retry ? <Cta href="/checkout">Pay again</Cta> : null}
          {order.status === 'awaiting_payment' ? <Link href="/checkout">Left the payment page? Pay again from checkout</Link> : null}
        </div>
      </Field>

      <div className={s.details}>
        <section className={s.block} aria-labelledby="pickup">
          <Label ink="secondary" as="h2" id="pickup">{retry ? 'Pick-up, once paid' : 'Pick-up'}</Label>
          <Type role="subhead" as="p">{formatShopTime(storefront.timeZone, order.pickupAt)}</Type>
          <Type role="body">{storefront.address.join(', ')}</Type>
          <Link href={storefront.mapHref} isExternalLink>Open in Google Maps</Link>
          <Type role="caption" ink="secondary">
            Questions? Call <Link href={storefront.phone.href}>{storefront.phone.display}</Link> and give the code {order.code}.
          </Type>
        </section>

        <section className={s.block} aria-labelledby="items">
          <Label ink="secondary" as="h2" id="items">Your order</Label>
          <ul className={s.items}>
            {order.items.map((item) => (
              <li key={item.dishId} className={s.itemLine}>
                <Type role="body">{item.quantity} × {item.name}</Type>
                <Type role="body" className={s.money}>{formatRM(item.unitSen * item.quantity)}</Type>
              </li>
            ))}
          </ul>
          <OrderTotal totalSen={order.totalSen} />
        </section>
      </div>
    </Page>
  );
}

/**
 * "I'm here": one tap at the shop and the counter's board marks the order and rings, so it is
 * handed over without a queue. Once said, it stays said.
 */
function Arrival({order, onArrived}: {order: PublicOrder; onArrived: (order: PublicOrder) => void}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const said = useRef<HTMLParagraphElement>(null);
  const now = useNow();
  if (!now) return null;
  const open = canArrive(order.status, order.pickupAt, now);
  // "today, 7:50am": the day as part of a sentence.
  const opensAt = formatShopTime(storefront.timeZone, arrivalOpensAt(order.pickupAt).toISOString(), now).replace(/^(Today|Tomorrow)/, (day) => day.toLowerCase());
  const arrive = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const next = await arriveForOrder({data: {id: order.id}});
      if (next?.arrivedAt) {
        onArrived(next);
        // The button goes once it has been said, so focus moves to what replaced it.
        requestAnimationFrame(() => said.current?.focus());
      } else setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };
  return (
    <Stack gap="xs">
      {!order.arrivedAt && open ? <Cta busy={busy} onClick={arrive}>I’m here</Cta> : null}
      {/* Rendered before the tap, so its words are announced when they arrive. */}
      <p role="status" ref={said} tabIndex={-1} className={s.said}>
        {order.arrivedAt ? (
          <Type role="body" className={s.arrived}>
            The counter knows you’re here. {order.status === 'ready' ? 'Your order is waiting.' : 'We’ll call your name as soon as it’s ready.'}
          </Type>
        ) : null}
      </p>
      {order.arrivedAt ? null : (
        <Type role="caption" ink="secondary">
          {failed ? 'That didn’t go through. Try again, or give your code at the counter.' : open ? 'Tap when you reach the shop, and the counter will know.' : `I’m here opens ${opensAt}, or as soon as your order is ready. Tap it at the shop and the counter will know.`}
        </Type>
      )}
    </Stack>
  );
}
