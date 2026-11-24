// Deliveries in D1, one row per delivered order. Every change of state is one guarded UPDATE
// (`WHERE state = <the state it was read in>`), so two callers racing on one delivery cannot both
// book it, and a late webhook cannot move it backwards past what was read.
import {KITCHEN_STATUSES} from '../orders/model';
import {BOOKING_ATTEMPTS, BOOKING_CLAIM_MINUTES, DELIVERY_STATES, type DeliveryState, type DropOff} from './model';
import type {Booking, Driver, Tracking} from './courier';

export type DeliveryRow = {
  orderId: string;
  dropOff: DropOff;
  distanceM: number;
  feeSen: number;
  state: DeliveryState;
  attempts: number;
  courierOrderId: string | null;
  shareLink: string | null;
  driver: Driver | null;
  costSen: number | null;
  problem: string | null;
  bookedAt: string | null;
};

export type DeliveryRecord = {
  order_id: string; address: string; unit: string; note: string; lat: number; lng: number; distance_m: number; fee_sen: number; state: string;
  attempts: number; courier_order_id: string | null; share_link: string | null; driver_name: string | null; driver_phone: string | null;
  driver_plate: string | null; cost_sen: number | null; problem: string | null; booked_at: string | null;
};

export function toDelivery(record: DeliveryRecord): DeliveryRow {
  const state = DELIVERY_STATES.find((s) => s === record.state);
  if (!state) throw new Error(`delivery for order ${record.order_id} has unknown state ${record.state}`);
  return {
    orderId: record.order_id,
    dropOff: {address: record.address, unit: record.unit, note: record.note, place: {lat: record.lat, lng: record.lng}},
    distanceM: record.distance_m,
    feeSen: record.fee_sen,
    state,
    attempts: record.attempts,
    courierOrderId: record.courier_order_id,
    shareLink: record.share_link,
    driver: record.driver_name ? {name: record.driver_name, phone: record.driver_phone ?? '', plate: record.driver_plate ?? ''} : null,
    costSen: record.cost_sen,
    problem: record.problem,
    bookedAt: record.booked_at,
  };
}

/** The INSERT for a new delivery, batched with its order's own. */
export const insertDelivery = (db: D1Database, orderId: string, delivery: {dropOff: DropOff; distanceM: number; feeSen: number}, now: string) =>
  db
    .prepare(
      `INSERT INTO deliveries (order_id, address, unit, note, lat, lng, distance_m, fee_sen, state, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`,
    )
    .bind(orderId, delivery.dropOff.address, delivery.dropOff.unit, delivery.dropOff.note, delivery.dropOff.place.lat, delivery.dropOff.place.lng, delivery.distanceM, delivery.feeSen, now);

const placeholders = (values: readonly unknown[]) => values.map(() => '?').join(', ');
const minutesBefore = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
/** Deliveries of this shop's orders only. */
const OF_SHOP = 'order_id IN (SELECT id FROM orders WHERE shop_id = ?)';

export function deliveriesRepo(db: D1Database, shopId: string) {
  return {
    async get(orderId: string): Promise<DeliveryRow | null> {
      const record = await db.prepare(`SELECT * FROM deliveries WHERE order_id = ? AND ${OF_SHOP}`).bind(orderId, shopId).first<DeliveryRecord>();
      return record ? toDelivery(record) : null;
    },

    async byCourierOrder(courierOrderId: string): Promise<DeliveryRow | null> {
      const record = await db.prepare(`SELECT * FROM deliveries WHERE courier_order_id = ? AND ${OF_SHOP}`).bind(courierOrderId, shopId).first<DeliveryRecord>();
      return record ? toDelivery(record) : null;
    },

    /**
     * Takes the right to book a rider for an order the kitchen has: from waiting or failed, and
     * from stuck too when staff ask by hand, who may book past the job's attempts. Returns the
     * attempt this is; null when someone else holds it, it is booked, or it is not to be booked.
     */
    async claim(orderId: string, now: Date, byHand: boolean): Promise<number | null> {
      const from: DeliveryState[] = byHand ? ['waiting', 'failed', 'stuck'] : ['waiting', 'failed'];
      const row = await db
        .prepare(
          // The last booking's id goes with it, so a late webhook about that ride finds nothing to move.
          `UPDATE deliveries SET state = 'booking', attempts = attempts + 1, problem = NULL, courier_order_id = NULL, share_link = NULL,
             driver_name = NULL, driver_phone = NULL, driver_plate = NULL, updated_at = ?
           WHERE order_id = ? AND state IN (${placeholders(from)}) AND (? OR attempts < ?)
             AND order_id IN (SELECT id FROM orders WHERE shop_id = ? AND status IN (${placeholders(KITCHEN_STATUSES)}))
           RETURNING attempts`,
        )
        .bind(now.toISOString(), orderId, ...from, byHand ? 1 : 0, BOOKING_ATTEMPTS, shopId, ...KITCHEN_STATUSES)
        .first<{attempts: number}>();
      return row?.attempts ?? null;
    },

    async booked(orderId: string, booking: Booking, state: DeliveryState, now: Date) {
      await db
        .prepare(
          `UPDATE deliveries SET state = ?, courier_order_id = ?, share_link = ?, cost_sen = ?, booked_at = ?, driver_name = NULL, driver_phone = NULL, driver_plate = NULL, updated_at = ?
           WHERE order_id = ? AND state = 'booking'`,
        )
        .bind(state, booking.courierOrderId, booking.shareLink, booking.costSen, now.toISOString(), now.toISOString(), orderId)
        .run();
    },

    /** A claim that did not book: back to the job (`failed`) or to staff (`stuck`, with why). */
    async release(orderId: string, to: 'failed' | 'stuck', problem: string | null, now: Date) {
      await db.prepare(`UPDATE deliveries SET state = ?, problem = ?, updated_at = ? WHERE order_id = ? AND state = 'booking'`).bind(to, problem, now.toISOString(), orderId).run();
    },

    /** Applies what the courier said, if the delivery is still in the state it was read in. */
    async track(orderId: string, from: DeliveryState, to: DeliveryState, tracking: Tracking, problem: string | null, now: Date): Promise<boolean> {
      const result = await db
        .prepare(
          `UPDATE deliveries SET state = ?, share_link = COALESCE(?, share_link), driver_name = ?, driver_phone = ?, driver_plate = ?, problem = ?, updated_at = ?
           WHERE order_id = ? AND state = ?`,
        )
        .bind(to, tracking.shareLink, tracking.driver?.name ?? null, tracking.driver?.phone ?? null, tracking.driver?.plate ?? null, problem, now.toISOString(), orderId, from)
        .run();
      return result.meta.changes > 0;
    },

    /** Moves a delivery from `from` to `to` with nothing else changed. */
    async move(orderId: string, from: DeliveryState, to: DeliveryState, problem: string | null, now: Date): Promise<boolean> {
      const result = await db.prepare('UPDATE deliveries SET state = ?, problem = ?, updated_at = ? WHERE order_id = ? AND state = ?').bind(to, problem, now.toISOString(), orderId, from).run();
      return result.meta.changes > 0;
    },

    /** Orders the kitchen has whose rider is due: collection within `ahead` minutes, not yet booked, attempts left. */
    async due(now: Date, aheadMinutes: number, limit: number): Promise<string[]> {
      const rows = await db
        .prepare(
          `SELECT d.order_id FROM deliveries d JOIN orders o ON o.id = d.order_id
           WHERE o.shop_id = ? AND o.status IN (${placeholders(KITCHEN_STATUSES)}) AND d.state IN ('waiting', 'failed') AND d.attempts < ? AND o.pickup_at <= ?
           ORDER BY o.pickup_at LIMIT ?`,
        )
        .bind(shopId, ...KITCHEN_STATUSES, BOOKING_ATTEMPTS, new Date(now.getTime() + aheadMinutes * 60_000).toISOString(), limit)
        .all<{order_id: string}>();
      return rows.results.map((row) => row.order_id);
    },

    /** Bookings the courier is still working on, oldest update first: the job asks after each. */
    async live(limit: number): Promise<DeliveryRow[]> {
      const rows = await db
        .prepare(`SELECT * FROM deliveries WHERE state IN ('finding_rider', 'rider_assigned', 'on_the_way') AND courier_order_id IS NOT NULL AND ${OF_SHOP} ORDER BY updated_at LIMIT ?`)
        .bind(shopId, limit)
        .all<DeliveryRecord>();
      return rows.results.map(toDelivery);
    },

    /** Claims that never finished: they go to staff, never back to booking, as the courier may hold a booking. */
    async lapsedClaims(now: Date): Promise<string[]> {
      const rows = await db
        .prepare(
          `UPDATE deliveries SET state = 'stuck', problem = ?, updated_at = ?
           WHERE state = 'booking' AND updated_at < ? AND ${OF_SHOP} RETURNING order_id`,
        )
        .bind('A booking did not finish. Check Lalamove’s Partner Portal for this order before booking again: a rider may already be booked.', now.toISOString(), minutesBefore(now, BOOKING_CLAIM_MINUTES), shopId)
        .all<{order_id: string}>();
      return rows.results.map((row) => row.order_id);
    },

    /** Deliveries of refunded orders that still stand: to cancel at the courier, or simply close. A ride Lalamove would not cancel is left to finish. */
    async ofRefunded(limit: number): Promise<DeliveryRow[]> {
      const rows = await db
        .prepare(
          `SELECT d.* FROM deliveries d JOIN orders o ON o.id = d.order_id
           WHERE o.shop_id = ? AND o.status = 'refunded'
             AND (d.state IN ('waiting', 'failed', 'stuck') OR (d.state IN ('finding_rider', 'rider_assigned') AND d.problem IS NULL)) LIMIT ?`,
        )
        .bind(shopId, limit)
        .all<DeliveryRecord>();
      return rows.results.map(toDelivery);
    },
  };
}

export type DeliveriesRepo = ReturnType<typeof deliveriesRepo>;
