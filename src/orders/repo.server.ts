// Orders in D1. Every status change is one guarded UPDATE (`WHERE status IN <allowed from>`),
// so a repeated or late event changes nothing instead of moving an order backwards.
import {KITCHEN_STATUSES, ORDER_STATUSES, allowedFrom, statusForPayment, type Customer, type OrderStatus, type PricedCart, type PricedLine} from './model';
import type {ConfirmedEvent} from '../payments/provider';

export type OrderRow = {
  id: string;
  status: OrderStatus;
  pickupAt: string;
  customer: Customer;
  totalSen: number;
  purchaseId: string | null;
  createdAt: string;
  items: PricedLine[];
};

type OrderRecord = {
  id: string; status: string; pickup_at: string; customer_name: string; phone: string; email: string; note: string;
  total_sen: number; purchase_id: string | null; created_at: string;
};
type ItemRecord = {order_id: string; dish_id: string; name: string; unit_sen: number; quantity: number};

function toRow(record: OrderRecord, items: ItemRecord[]): OrderRow {
  const status = ORDER_STATUSES.find((s) => s === record.status);
  if (!status) throw new Error(`order ${record.id} has unknown status ${record.status}`);
  return {
    id: record.id,
    status,
    pickupAt: record.pickup_at,
    customer: {name: record.customer_name, phone: record.phone, email: record.email, note: record.note},
    totalSen: record.total_sen,
    purchaseId: record.purchase_id,
    createdAt: record.created_at,
    items: items.filter((item) => item.order_id === record.id).map((item) => ({dishId: item.dish_id, name: item.name, unitSen: item.unit_sen, quantity: item.quantity})),
  };
}

const placeholders = (values: readonly unknown[]) => values.map(() => '?').join(', ');

export function ordersRepo(db: D1Database, shopId: string) {
  const move = async (id: string, to: OrderStatus, now: Date): Promise<boolean> => {
    const from = allowedFrom(to);
    const stamp = now.toISOString();
    const result = await db
      .prepare(
        `UPDATE orders SET status = ?, updated_at = ?, paid_at = CASE WHEN ? = 'paid' THEN ? ELSE paid_at END
         WHERE id = ? AND shop_id = ? AND status IN (${placeholders(from)})`,
      )
      .bind(to, stamp, to, stamp, id, shopId, ...from)
      .run();
    return result.meta.changes > 0;
  };

  return {
    move,

    async create(input: {id: string; cart: PricedCart; customer: Customer; pickupAt: string; paymentMethod: string; now: Date}) {
      const now = input.now.toISOString();
      await db.batch([
        db
          .prepare(
            `INSERT INTO orders (id, shop_id, status, pickup_at, customer_name, phone, email, note, total_sen, payment_method, created_at, updated_at)
             VALUES (?, ?, 'awaiting_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(input.id, shopId, input.pickupAt, input.customer.name, input.customer.phone, input.customer.email, input.customer.note, input.cart.totalSen, input.paymentMethod, now, now),
        ...input.cart.lines.map((line) =>
          db.prepare('INSERT INTO order_items (order_id, dish_id, name, unit_sen, quantity) VALUES (?, ?, ?, ?, ?)').bind(input.id, line.dishId, line.name, line.unitSen, line.quantity),
        ),
      ]);
    },

    async attachPurchase(id: string, purchaseId: string) {
      await db.prepare('UPDATE orders SET purchase_id = ? WHERE id = ? AND shop_id = ?').bind(purchaseId, id, shopId).run();
    },

    async get(id: string): Promise<OrderRow | null> {
      // Both reads at once: the items query needs only the id.
      const [record, items] = await Promise.all([
        db.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').bind(id, shopId).first<OrderRecord>(),
        db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all<ItemRecord>(),
      ]);
      return record ? toRow(record, items.results) : null;
    },

    /** Orders the kitchen is working on, soonest pick-up first, plus those collected since `since`. */
    async kitchen(since: Date): Promise<OrderRow[]> {
      const where = `shop_id = ? AND (status IN (${placeholders(KITCHEN_STATUSES)}) OR (status = 'collected' AND updated_at >= ?))`;
      const binds = [shopId, ...KITCHEN_STATUSES, since.toISOString()];
      const [orders, items] = await Promise.all([
        db.prepare(`SELECT * FROM orders WHERE ${where} ORDER BY pickup_at`).bind(...binds).all<OrderRecord>(),
        db.prepare(`SELECT * FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE ${where})`).bind(...binds).all<ItemRecord>(),
      ]);
      return orders.results.map((record) => toRow(record, items.results));
    },

    /**
     * Applies a verified payment event to the order it names. Every copy is applied, not only
     * the first: moves are guarded, so a retry after a failed move still lands and a duplicate
     * changes nothing. Returns false when the event is not for one of this shop's purchases.
     */
    async applyPayment(event: ConfirmedEvent, body: string, now: Date): Promise<boolean> {
      const order = await db.prepare('SELECT purchase_id FROM orders WHERE id = ? AND shop_id = ?').bind(event.orderId, shopId).first<{purchase_id: string | null}>();
      if (!order || order.purchase_id !== event.purchaseId) return false;
      await db
        .prepare('INSERT OR IGNORE INTO payment_events (id, order_id, kind, received_at, body) VALUES (?, ?, ?, ?, ?)')
        .bind(event.eventId, event.orderId, event.state, now.toISOString(), body)
        .run();
      const to = statusForPayment(event.state);
      if (to) await move(event.orderId, to, now);
      return true;
    },
  };
}

export function staffAttempts(db: D1Database) {
  return {
    /** Failures since `since` from one address, or from every address when `ip` is null. */
    async recentFailures(ip: string | null, since: Date) {
      const query = ip === null
        ? db.prepare('SELECT COUNT(*) AS n FROM staff_login_failures WHERE at >= ?').bind(since.toISOString())
        : db.prepare('SELECT COUNT(*) AS n FROM staff_login_failures WHERE ip = ? AND at >= ?').bind(ip, since.toISOString());
      const row = await query.first<{n: number}>();
      return row?.n ?? 0;
    },
    /** Records a failure and forgets those older than `keepSince`, which no lockout reads. */
    async fail(ip: string, now: Date, keepSince: Date) {
      await db.batch([
        db.prepare('INSERT INTO staff_login_failures (ip, at) VALUES (?, ?)').bind(ip, now.toISOString()),
        db.prepare('DELETE FROM staff_login_failures WHERE at < ?').bind(keepSince.toISOString()),
      ]);
    },
  };
}
