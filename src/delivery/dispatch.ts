// Getting each paid delivery a rider, and keeping the order in step with the ride. Booking is
// claimed before the courier is called, so the payment callback, the order page, the kitchen and
// the 5-minute job can all ask at once and the courier still gets one booking. A claim that never
// finished goes to staff, not back to booking: the courier may have taken it.
import type {Alert} from '../ops/alert.server';
import {KITCHEN_STATUSES, orderCode, type OrderStatus} from '../orders/model';
import type {OrderRow} from '../orders/repo.server';
import {CourierError, type Booking, type Courier} from './courier';
import type {DeliveriesRepo, DeliveryRow} from './repo.server';
import {BOOKING_ATTEMPTS, BOOK_AHEAD_MINUTES, isLive, stateForCourier, type DeliveryArea, type DeliveryState, type Place} from './model';

/** Under this many minutes before collection, the rider is booked for as soon as possible rather than for a time. */
export const IMMEDIATE_WITHIN_MINUTES = 10;
const PER_RUN = 20;

export type DispatchDeps = {
  deliveries: Pick<DeliveriesRepo, 'get' | 'byCourierOrder' | 'claim' | 'booked' | 'release' | 'track' | 'move' | 'due' | 'live' | 'lapsedClaims' | 'ofRefunded'>;
  orders: {get(id: string): Promise<OrderRow | null>; move(id: string, to: OrderStatus, now: Date): Promise<boolean>};
  courier: Courier;
  area: DeliveryArea & {from: Place};
  shop: {name: string; phone: string; address: string};
  alert(alert: Alert): Promise<void>;
  /** Sends whatever emails the order is now due. */
  notify(orderId: string): void;
  now: Date;
};

/** When to ask the rider to collect: the order's time, or now when that is close or past (late money can arrive after it). */
export function collectAt(pickupAt: string, now: Date): Date | null {
  const at = new Date(pickupAt);
  return at.getTime() - now.getTime() < IMMEDIATE_WITHIN_MINUTES * 60_000 ? null : at;
}

/** Whether the job should book this order now: its collection is within the booking window. */
export const isDue = (pickupAt: string, now: Date) => Date.parse(pickupAt) - now.getTime() <= BOOK_AHEAD_MINUTES * 60_000;

/** What the rider reads at the door. Phone numbers stay with Lalamove's own fields. */
export const remarksFor = (order: OrderRow, delivery: DeliveryRow) =>
  [delivery.dropOff.unit, delivery.dropOff.note, `Cake Jalan Tiung order ${orderCode(order.id)}`].filter((line) => line.trim().length > 0).join('\n');

/**
 * Books a rider for this order if it is due (or staff ask by hand). Returns where the delivery
 * now stands, or null when there was nothing to book.
 */
export async function book(orderId: string, deps: DispatchDeps, {byHand = false} = {}): Promise<DeliveryState | null> {
  const [order, delivery] = await Promise.all([deps.orders.get(orderId), deps.deliveries.get(orderId)]);
  if (!order || !delivery) return null;
  if (!byHand && !isDue(order.pickupAt, deps.now)) return null;
  const attempt = await deps.deliveries.claim(orderId, deps.now, byHand);
  if (attempt === null) return null;
  const code = orderCode(order.id);
  let booking: Booking;
  try {
    booking = await deps.courier.book(
      {
        from: {place: deps.area.from, address: deps.shop.address},
        to: {place: delivery.dropOff.place, address: delivery.dropOff.address},
        at: collectAt(order.pickupAt, deps.now),
        sender: {name: deps.shop.name, phone: deps.shop.phone},
        recipient: {name: order.customer.name, phone: order.customer.phone},
        remarks: remarksFor(order, delivery),
        reference: order.id,
      },
      deps.area.service,
    );
  } catch (error) {
    const kind = error instanceof CourierError ? error.kind : 'retry';
    const reason = error instanceof Error ? error.message : String(error);
    if (kind === 'unsure') {
      // Booking again could send a second rider and pay twice: a person checks first.
      await deps.deliveries.release(orderId, 'stuck', `${reason}. Check Lalamove’s Partner Portal for this order before booking again: a rider may already be on the way.`, deps.now);
      await deps.alert({
        key: `delivery-unsure:${order.id}`,
        subject: `Order ${code}'s rider booking may or may not have gone through`,
        body: `Booking a rider for order ${code} ended without a clear answer: ${reason}\n\nCheck Lalamove's Partner Portal for this order. If it is not there, use Book rider now on /staff; if it is, call the shop's developer to link it.`,
      });
      return 'stuck';
    }
    if (kind === 'refused' || byHand || attempt >= BOOKING_ATTEMPTS) {
      await deps.deliveries.release(orderId, 'stuck', `No rider booked: ${reason}`, deps.now);
      await deps.alert({
        key: `delivery-refused:${order.id}`,
        subject: `Order ${code} has no rider`,
        body: `Booking a rider for order ${code} failed (attempt ${attempt}): ${reason}\n\nIt needs staff: on /staff, call the customer, then Book rider again or refund the order.`,
      });
      return 'stuck';
    }
    await deps.deliveries.release(orderId, 'failed', null, deps.now);
    return 'failed';
  }
  // Lalamove has the ride now. Should recording it fail, the claim is left to lapse into `stuck`,
  // never released to be booked again.
  const state = stateForCourier('finding_rider', booking.status) ?? 'finding_rider';
  await deps.deliveries.booked(orderId, booking, state, deps.now);
  if (booking.costSen > delivery.feeSen) {
    await deps.alert({
      key: 'delivery-cost-above-fee',
      subject: 'A rider cost more than the customer paid for delivery',
      body: `Order ${code}'s ride was booked at RM ${(booking.costSen / 100).toFixed(2)}; the customer paid RM ${(delivery.feeSen / 100).toFixed(2)} for it at checkout. The shop pays the difference. One is normal (Lalamove's prices move); if it happens often, consider adding a margin to the fee.`,
    });
  }
  return state;
}

/**
 * Asks the courier how a booking stands and brings the delivery and the order in step: picked up
 * clears the kitchen board and emails the customer; given up goes back to the job to book again
 * while the kitchen has the order and tries remain, and to staff otherwise.
 */
export async function refresh(delivery: DeliveryRow, deps: DispatchDeps): Promise<void> {
  if (!delivery.courierOrderId) return;
  const tracking = await deps.courier.track(delivery.courierOrderId);
  const to = stateForCourier(delivery.state, tracking.status);
  const code = orderCode(delivery.orderId);
  if (to === null) {
    // Same state, new details (a driver, a link): keep them.
    if (isLive(delivery.state)) await deps.deliveries.track(delivery.orderId, delivery.state, delivery.state, tracking, delivery.problem, deps.now);
    return;
  }
  if (to === 'failed') {
    const order = await deps.orders.get(delivery.orderId);
    if (order?.status === 'refunded') {
      await deps.deliveries.track(delivery.orderId, delivery.state, 'cancelled', tracking, null, deps.now);
      return;
    }
    const inKitchen = order !== null && KITCHEN_STATUSES.includes(order.status);
    if (inKitchen && delivery.attempts < BOOKING_ATTEMPTS) {
      // Back to the job at once, so a new rider is looked for in this same run if due.
      if (await deps.deliveries.track(delivery.orderId, delivery.state, 'failed', tracking, null, deps.now)) await book(delivery.orderId, deps);
      return;
    }
    // Out of tries, or lost after it left the counter: nothing books it again without a person.
    const problem = inKitchen ? `Lalamove found no rider ${BOOKING_ATTEMPTS} times.` : 'Lalamove ended this ride without delivering it.';
    if (await deps.deliveries.track(delivery.orderId, delivery.state, 'stuck', tracking, problem, deps.now)) {
      await deps.alert({
        key: `delivery-gave-up:${delivery.orderId}`,
        subject: inKitchen ? `Order ${code} has no rider` : `Order ${code}'s ride ended without delivering it`,
        body: `${problem} On /staff, call the customer about order ${code}, then Book rider again or refund the order.`,
      });
    }
    return;
  }
  // Its note, if any (a refund Lalamove would not cancel), stays with it as the ride goes on.
  if (!(await deps.deliveries.track(delivery.orderId, delivery.state, to, tracking, delivery.problem, deps.now))) return;
  if (to === 'on_the_way' || to === 'delivered') {
    // The rider has it: the kitchen is done with it, even if nobody pressed Accept or Mark ready.
    for (const step of ['accepted', 'ready', 'collected'] as const) await deps.orders.move(delivery.orderId, step, deps.now);
    deps.notify(delivery.orderId);
  }
}

/**
 * The 5-minute job's part: lapsed claims to staff, refunded orders' rides cancelled, due orders
 * booked, live bookings asked after. Each step runs even when one delivery in it fails.
 */
export async function sweep(deps: DispatchDeps): Promise<void> {
  const failures: string[] = [];
  const attempt = async (what: string, step: () => Promise<unknown>) => {
    try {
      await step();
    } catch (error) {
      failures.push(`${what}: ${String(error)}`);
    }
  };

  for (const orderId of await deps.deliveries.lapsedClaims(deps.now)) {
    await deps.alert({
      key: `delivery-lapsed:${orderId}`,
      subject: `Order ${orderCode(orderId)}'s rider booking did not finish`,
      body: `Booking a rider for order ${orderCode(orderId)} started and never finished. Lalamove may or may not have the booking. Check the Partner Portal before using Book rider on /staff, or the customer may get two riders.`,
    });
  }

  for (const delivery of await deps.deliveries.ofRefunded(PER_RUN)) {
    await attempt(`cancel ${orderCode(delivery.orderId)}`, async () => {
      if (isLive(delivery.state) && delivery.courierOrderId) {
        if (await deps.courier.cancel(delivery.courierOrderId)) await deps.deliveries.move(delivery.orderId, delivery.state, 'cancelled', null, deps.now);
        else {
          // The ride goes on and is still followed; the note keeps the job from asking Lalamove again.
          await deps.deliveries.move(delivery.orderId, delivery.state, delivery.state, 'Refunded, but Lalamove no longer lets this ride be cancelled.', deps.now);
          await deps.alert({
            key: `delivery-cancel:${delivery.orderId}`,
            subject: `Order ${orderCode(delivery.orderId)} was refunded but its rider could not be cancelled`,
            body: `Lalamove refused to cancel the ride for refunded order ${orderCode(delivery.orderId)}: a rider has already taken it. Cancel it in the Partner Portal or tell the rider.`,
          });
        }
      } else await deps.deliveries.move(delivery.orderId, delivery.state, 'cancelled', null, deps.now);
    });
  }

  for (const orderId of await deps.deliveries.due(deps.now, BOOK_AHEAD_MINUTES, PER_RUN)) {
    await attempt(`book ${orderCode(orderId)}`, () => book(orderId, deps));
  }

  for (const delivery of await deps.deliveries.live(PER_RUN)) {
    await attempt(`track ${orderCode(delivery.orderId)}`, () => refresh(delivery, deps));
  }

  if (failures.length > 0) throw new Error(failures.join('\n'));
}
