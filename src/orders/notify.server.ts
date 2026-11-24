// The order emails, wired to D1 and the sending binding. Every place that moves an order to paid
// or ready asks `notifyLater` right after; the 5-minute job's `sendDueEmails` catches whatever
// those missed or failed. Both only ask `notifyOrder`, which decides from the order as it is.
import {env, waitUntil} from 'cloudflare:workers';
import {storefront} from '../site/content';
import {sendAlert} from '../ops/alert.server';
import {SOLD_STATUSES} from './model';
import {EMAIL_ATTEMPTS, EMAIL_CLAIM_MINUTES, notifyOrder, type NotifyDeps} from './notify';
import {ordersRepo} from './repo.server';

const FROM = 'orders@hello.cakejalantiung.app';
/** How far back the 5-minute job looks for emails still owed, and how many orders it takes per run. */
const OWED_HOURS = 24;
const PER_RUN = 20;

type NotifyEnv = {DB: D1Database; SHOP_ID: string; ORDER_EMAIL: SendEmail; SITE_URL: string; ALERT_EMAIL: SendEmail; ALERT_TO: string};

const minutesBefore = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const placeholders = (values: readonly unknown[]) => values.map(() => '?').join(', ');

function deps(target: NotifyEnv, now: Date): NotifyDeps {
  const db = target.DB;
  const orders = ordersRepo(db, target.SHOP_ID);
  return {
    async order(id) {
      const row = await orders.get(id);
      return row && {...row, email: row.customer.email};
    },
    emails: {
      async claim(orderId, kind, at) {
        const result = await db
          .prepare(
            `INSERT INTO order_emails (order_id, kind, state, attempts, updated_at) VALUES (?, ?, 'sending', 1, ?)
             ON CONFLICT (order_id, kind) DO UPDATE SET state = 'sending', attempts = order_emails.attempts + 1, updated_at = excluded.updated_at
             WHERE order_emails.attempts < ? AND (order_emails.state = 'failed' OR (order_emails.state = 'sending' AND order_emails.updated_at < ?))
             RETURNING attempts`,
          )
          .bind(orderId, kind, at.toISOString(), EMAIL_ATTEMPTS, minutesBefore(at, EMAIL_CLAIM_MINUTES))
          .first<{attempts: number}>();
        return result?.attempts ?? null;
      },
      async finish(orderId, kind, outcome, at) {
        await db.prepare('UPDATE order_emails SET state = ?, updated_at = ? WHERE order_id = ? AND kind = ?').bind(outcome, at.toISOString(), orderId, kind).run();
      },
    },
    async send(to, email) {
      await target.ORDER_EMAIL.send({
        to,
        from: {email: FROM, name: storefront.name},
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: email.attachments?.map((file) => ({disposition: 'attachment' as const, ...file})),
      });
    },
    alert: (alert) => sendAlert(alert, target, now),
    store: storefront,
    origin: target.SITE_URL.replace(/\/+$/, ''),
    now,
  };
}

/**
 * Sends this order's due emails after the response, for code that runs inside a request. Built
 * inside the promise, so not even a misconfigured binding can throw into the request that asked.
 */
export const notifyLater = (orderId: string) => waitUntil(Promise.resolve().then(() => notifyOrder(orderId, deps(env, new Date()))).catch((error: unknown) => console.error('Order emails not sent', error)));

/**
 * The 5-minute job: orders that may still be owed an email, by the same rules as `ORDER_EMAILS`
 * (paid and not refunded; ready and not yet arrived), with no email of that kind sent, skipped or
 * given up. `notifyOrder` checks each again before sending.
 */
export async function sendDueEmails(target: NotifyEnv, now: Date = new Date()) {
  const owed = (kind: string) =>
    `NOT EXISTS (SELECT 1 FROM order_emails e WHERE e.order_id = o.id AND e.kind = '${kind}' AND (e.state IN ('sent', 'skipped') OR e.attempts >= ?))`;
  const rows = await target.DB.prepare(
    `SELECT o.id FROM orders o WHERE o.shop_id = ? AND o.updated_at >= ? AND (
       (o.status IN (${placeholders(SOLD_STATUSES)}) AND ${owed('paid')})
       OR (o.status = 'ready' AND o.arrived_at IS NULL AND ${owed('ready')})
     ) ORDER BY o.updated_at DESC LIMIT ?`,
  )
    .bind(target.SHOP_ID, minutesBefore(now, OWED_HOURS * 60), ...SOLD_STATUSES, EMAIL_ATTEMPTS, EMAIL_ATTEMPTS, PER_RUN)
    .all<{id: string}>();
  const shared = deps(target, now);
  for (const {id} of rows.results) await notifyOrder(id, shared);
}
