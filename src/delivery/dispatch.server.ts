// Dispatch wired to D1, the courier and alerts. Every place an order becomes paid asks
// `dispatchLater` right after, so a delivery due soon is booked at once; the 5-minute job's
// `dispatchDue` books the rest as their time comes and follows every ride in flight.
import {env, waitUntil} from 'cloudflare:workers';
import {storefront} from '../site/content';
import {sendAlert} from '../ops/alert.server';
import {ordersRepo} from '../orders/repo.server';
import {notifyOrder} from '../orders/notify';
import {notifyDeps, type NotifyEnv} from '../orders/notify.server';
import {deliveriesRepo} from './repo.server';
import {book, refresh, sweep, type DispatchDeps} from './dispatch';
import {deliverySetup} from './select.server';

type DispatchEnv = NotifyEnv & {PAYMENTS: string};

/** The shop's phone as Lalamove wants it, from the storefront's tel: link. */
const shopPhone = storefront.phone.href.replace(/^tel:/, '');

export function dispatchDeps(target: DispatchEnv, now: Date): DispatchDeps | null {
  const delivery = deliverySetup(target, storefront);
  if (!delivery) return null;
  const notify = notifyDeps(target, now);
  return {
    deliveries: deliveriesRepo(target.DB, target.SHOP_ID),
    orders: ordersRepo(target.DB, target.SHOP_ID),
    courier: delivery.courier,
    area: delivery.area,
    shop: {name: storefront.name, phone: shopPhone, address: storefront.address.join(', ')},
    alert: (alert) => sendAlert(alert, target, now),
    notify: (orderId) => waitUntil(notifyOrder(orderId, notify)),
    now,
  };
}

/**
 * Books this order's rider after the response if it is due now, for code inside a request.
 * `byHand` books whatever the time, as staff asked. Never throws into the request.
 */
export const dispatchLater = (orderId: string, {byHand = false} = {}) =>
  waitUntil(
    Promise.resolve()
      .then(() => {
        const deps = dispatchDeps(env, new Date());
        return deps ? book(orderId, deps, {byHand}) : null;
      })
      .catch((error: unknown) => console.error('Rider not booked', error)),
  );

/** A webhook named this booking: read it from the courier and bring the order in step. */
export async function followBooking(courierOrderId: string) {
  const deps = dispatchDeps(env, new Date());
  const delivery = deps && (await deps.deliveries.byCourierOrder(courierOrderId));
  if (deps && delivery) await refresh(delivery, deps);
}

/** The 5-minute job: book what is due, follow what is in flight, cancel what was refunded. */
export async function dispatchDue(target: DispatchEnv, now: Date = new Date()) {
  const deps = dispatchDeps(target, now);
  if (deps) await sweep(deps);
}
