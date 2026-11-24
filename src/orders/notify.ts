// Sends the order emails that are due, each at most once. A send is claimed before it is made,
// so the callback, the order page and the 5-minute job can all ask at the same moment and the
// customer still gets one email. A failed send is released for the job to retry, a few times at
// most, so a mistyped address does not retry forever. Sending never throws: an email must not
// break the payment or the kitchen step that made it due.
import type {Alert} from '../ops/alert.server';
import {ORDER_EMAILS, ORDER_EMAIL_KINDS, orderEmail, type EmailOrder, type OrderEmail, type OrderEmailKind} from './email';
import {orderCode} from './model';
import type {Storefront} from '../storefront/model';

/** How many sends an email gets before it is given up, and how long a claim holds before a send that never finished may be tried again. */
export const EMAIL_ATTEMPTS = 3;
export const EMAIL_CLAIM_MINUTES = 10;

export type NotifyDeps = {
  /** The order as it is now, with the address to write to; null when there is none. */
  order(id: string): Promise<(EmailOrder & {email: string}) | null>;
  emails: {
    /** Takes the right to send; false when it is sent, being sent, given up or never to be sent. */
    claim(orderId: string, kind: OrderEmailKind, now: Date): Promise<boolean>;
    finish(orderId: string, kind: OrderEmailKind, outcome: 'sent' | 'failed', now: Date): Promise<void>;
  };
  send(to: string, email: OrderEmail): Promise<void>;
  alert(alert: Alert): Promise<void>;
  store: Storefront;
  origin: string;
  now: Date;
};

/** Sends whatever this order is due and has not had. */
export async function notifyOrder(id: string, deps: NotifyDeps): Promise<void> {
  try {
    const order = await deps.order(id);
    if (!order) return;
    for (const kind of ORDER_EMAIL_KINDS) {
      if (!ORDER_EMAILS[kind].isDue(order) || !(await deps.emails.claim(order.id, kind, deps.now))) continue;
      let failure: unknown = null;
      try {
        await deps.send(order.email, orderEmail(kind, order, deps.store, deps.origin));
      } catch (error) {
        failure = error ?? 'unknown error';
      }
      // A send that failed is released for the 5-minute job; one that went is recorded as sent.
      await deps.emails.finish(order.id, kind, failure === null ? 'sent' : 'failed', deps.now);
      if (failure === null) continue;
      // The address stays out of the alert: only the order code identifies the customer there.
      const reason = String(failure).replaceAll(order.email, '<customer address>');
      await deps.alert({
        key: `order-email:${kind}`,
        subject: `A customer's "${kind}" email did not send`,
        body: `The "${kind}" email for order ${orderCode(order.id)} failed: ${reason}\n\nThe 5-minute job tries again, ${EMAIL_ATTEMPTS} sends at most. The order itself is unaffected.`,
      });
    }
  } catch (error) {
    console.error('Order email check failed', error);
  }
}
