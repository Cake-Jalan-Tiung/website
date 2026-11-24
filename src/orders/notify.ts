// Sends the order emails that are due, each at most once. A send is claimed before it is made,
// so the callback, the order page and the 5-minute job can all ask at the same moment and the
// customer still gets one email. A failed send is released for the job to retry, a few times at
// most, so a mistyped address does not retry forever. Sending never throws: an email must not
// break the payment or the kitchen step that made it due.
import type {Alert} from '../ops/alert.server';
import {ORDER_EMAILS, ORDER_EMAIL_KINDS, orderEmail, type Attachment, type EmailOrder, type OrderEmail, type OrderEmailKind} from './email';
import {orderCode} from './model';
import type {Storefront} from '../storefront/model';

/** How many sends an email gets before it is given up, and how long a claim holds before a send that never finished may be tried again. */
export const EMAIL_ATTEMPTS = 3;
export const EMAIL_CLAIM_MINUTES = 10;
/** How long the receipt PDF may take before the email goes without it. */
const PDF_SECONDS = 8;

export type NotifyDeps = {
  /** The order as it is now, with the address to write to; null when there is none. */
  order(id: string): Promise<(EmailOrder & {email: string}) | null>;
  emails: {
    /** Takes the right to send and says which attempt this is; null when it is sent, being sent, given up or never to be sent. */
    claim(orderId: string, kind: OrderEmailKind, now: Date): Promise<number | null>;
    finish(orderId: string, kind: OrderEmailKind, outcome: 'sent' | 'failed', now: Date): Promise<void>;
  };
  send(to: string, email: OrderEmail): Promise<void>;
  alert(alert: Alert): Promise<void>;
  store: Storefront;
  origin: string;
  now: Date;
};

/**
 * The receipt as a PDF, or none: the email matters more than its attachment. A time limit stops a
 * slow draw; a draw that never yields (the Worker is cut off) is caught by the caller trying the PDF
 * on the first send only. pdf-lib loads only here, so no page request pays for it.
 */
async function receiptAttachment(order: EmailOrder, deps: NotifyDeps): Promise<Attachment[]> {
  try {
    const {receiptPdf, receiptFilename} = await import('./receipt-pdf');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const content = await Promise.race([
      receiptPdf(order, deps.store),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`took over ${PDF_SECONDS} s`)), PDF_SECONDS * 1000);
      }),
    ]).finally(() => clearTimeout(timer));
    return content ? [{filename: receiptFilename(order.id), type: 'application/pdf', content}] : [];
  } catch (error) {
    console.error('Receipt PDF not drawn', error);
    await deps.alert({
      key: 'receipt-pdf',
      subject: 'A receipt PDF could not be drawn',
      body: `The receipt for order ${orderCode(order.id)} went without its PDF: ${String(error)}\n\nThe email itself was sent. If this repeats, every receipt is going out without a PDF; check the Worker's logs.`,
    });
    return [];
  }
}

/** Sends whatever this order is due and has not had. */
export async function notifyOrder(id: string, deps: NotifyDeps): Promise<void> {
  try {
    const order = await deps.order(id);
    if (!order) return;
    for (const kind of ORDER_EMAIL_KINDS) {
      if (!ORDER_EMAILS[kind].isDue(order)) continue;
      const attempt = await deps.emails.claim(order.id, kind, deps.now);
      if (attempt === null) continue;
      // Only the first send tries the PDF: if drawing it is what failed or never finished, the retry still delivers the receipt.
      const attachments = ORDER_EMAILS[kind].page.receipt && attempt === 1 ? await receiptAttachment(order, deps) : [];
      let failure: unknown = null;
      try {
        await deps.send(order.email, {...orderEmail(kind, order, deps.store, deps.origin, attachments.length > 0), attachments});
      } catch (error) {
        failure = error ?? 'unknown error';
      }
      // A send that failed is released for the 5-minute job; one that went is recorded as sent. Should
      // that write fail, the claim lapses and the email can go twice: rarer and kinder than never.
      await deps.emails.finish(order.id, kind, failure === null ? 'sent' : 'failed', deps.now);
      if (failure === null) continue;
      // The address stays out of the alert: only the order code identifies the customer there.
      const reason = String(failure).replaceAll(order.email, '<customer address>');
      const code = orderCode(order.id);
      // Retries share one alert, held back for hours; giving up is alerted for each order, since that customer has no email.
      await deps.alert(
        attempt < EMAIL_ATTEMPTS
          ? {
              key: `order-email:${kind}`,
              subject: `A customer's "${kind}" email did not send`,
              body: `The "${kind}" email for order ${code} failed (send ${attempt} of ${EMAIL_ATTEMPTS}): ${reason}\n\nThe 5-minute job tries again. The order itself is unaffected.`,
            }
          : {
              key: `order-email:${kind}:${order.id}`,
              subject: `Order ${code}'s "${kind}" email was given up`,
              body: `The "${kind}" email for order ${code} failed ${EMAIL_ATTEMPTS} times and will not be sent: ${reason}\n\nThe customer has not been emailed. Look the order up on /staff and call them if it matters.`,
            },
      );
    }
  } catch (error) {
    console.error('Order email check failed', error);
  }
}
