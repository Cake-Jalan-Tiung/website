// The two emails a customer gets about an order, and when each is due. A receipt once it is
// paid, then a note once it is ready, which brings them back to the order's page to say
// "I'm here". Pure: the sender, the claims and the retries live in notify.server.ts.
import {color} from '../system/tokens';
import {formatShopDateTime} from '../storefront/hours';
import type {Storefront} from '../storefront/model';
import {SOLD_STATUSES, customerCopy, formatRM, orderCode, type OrderStatus, type PricedLine} from './model';

/** What an email needs to know about its order. */
export type EmailOrder = {
  id: string;
  status: OrderStatus;
  pickupAt: string;
  paidAt: string | null;
  customer: {name: string; note: string};
  items: readonly PricedLine[];
  totalSen: number;
  arrivedAt: string | null;
};

export type OrderEmail = {subject: string; text: string; html: string};

type Page = {
  subject: (code: string, pickup: string) => string;
  heading: string;
  lead: (firstName: string) => string;
  action: string;
  after: string;
  /** Whether to list what was bought: the receipt does, the ready note only names the code. */
  receipt: boolean;
};

/**
 * Every email, in one table: when it is due and what it says. Due is read from the order as it is
 * now, so a retry never sends a "ready" for an order already collected, or a receipt for one refunded.
 */
export const ORDER_EMAILS = {
  paid: {
    isDue: (order: EmailOrder) => SOLD_STATUSES.some((status) => status === order.status),
    page: {
      subject: (code, pickup) => `Receipt for order ${code} · pick-up ${pickup}`,
      heading: customerCopy('paid').title,
      lead: (firstName) => `Thank you, ${firstName}. Your order is paid and the kitchen has it.`,
      action: 'Follow your order',
      after: 'We’ll email you again when it’s ready.',
      receipt: true,
    },
  },
  ready: {
    // Someone already at the counter needs no email to come to it.
    isDue: (order: EmailOrder) => order.status === 'ready' && order.arrivedAt === null,
    page: {
      subject: (code) => `Order ${code} is ready to collect`,
      heading: customerCopy('ready').title,
      lead: (firstName) => `${firstName}, your order is ready.`,
      action: 'Open your order',
      after: 'When you reach the shop, tap I’m here on your order page, or give your code at the counter.',
      receipt: false,
    },
  },
} as const satisfies Record<string, {isDue: (order: EmailOrder) => boolean; page: Page}>;

export type OrderEmailKind = keyof typeof ORDER_EMAILS;
export const ORDER_EMAIL_KINDS = Object.keys(ORDER_EMAILS).filter((key): key is OrderEmailKind => key in ORDER_EMAILS);

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char] ?? char);

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

/** The email of this kind for this order. Customer and dish names go into the body only, escaped; the subject holds nothing they typed. */
export function orderEmail(kind: OrderEmailKind, order: EmailOrder, store: Storefront, origin: string): OrderEmail {
  const page: Page = ORDER_EMAILS[kind].page;
  const code = orderCode(order.id);
  const pickup = formatShopDateTime(store.timeZone, order.pickupAt);
  const firstName = order.customer.name.trim().split(/\s+/)[0] || 'there';
  const link = `${origin}/order/${order.id}`;
  const lines = order.items.map((line) => ({label: line.quantity > 1 ? `${line.quantity} × ${line.name}` : line.name, amount: formatRM(line.unitSen * line.quantity)}));
  const plainRM = (value: string) => value.replace('\u00a0', ' ');
  // On the receipt only: the note is what a cake order most needs checked (the words on the cake),
  // and the paid time is what an expense claim asks for.
  const note = page.receipt ? order.customer.note.trim() : '';
  const paid = page.receipt && order.paidAt ? formatShopDateTime(store.timeZone, order.paidAt) : '';

  const text = [
    page.heading,
    '',
    page.lead(firstName),
    '',
    `Order code: ${code}`,
    `Pick-up: ${pickup}`,
    `${store.name}, ${store.address.join(', ')}`,
    ...(note ? ['', `Your note: ${note}`] : []),
    ...(page.receipt ? ['', ...lines.map((line) => `${line.label}  ${plainRM(line.amount)}`), `Total paid  ${plainRM(formatRM(order.totalSen))}`] : []),
    ...(paid ? [`Paid ${paid}`] : []),
    '',
    `${page.action}: ${link}`,
    '',
    page.after,
    `Questions? Call ${store.phone.display}.`,
    '',
    store.signOff,
  ].join('\n');

  const cell = `padding: 8px 0; border-bottom: 1px solid ${color.rule};`;
  const rows = page.receipt
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 0 0 24px;">
${lines.map((line) => `<tr><td style="${cell}">${escape(line.label)}</td><td align="right" style="${cell} white-space: nowrap;">${line.amount}</td></tr>`).join('\n')}
<tr><td style="padding: 12px 0 0; font-weight: 600;">Total paid</td><td align="right" style="padding: 12px 0 0; font-weight: 600; white-space: nowrap;">${formatRM(order.totalSen)}</td></tr>
${paid ? `<tr><td colspan="2" style="padding: 4px 0 0; font-size: 14px; color: ${color.muted};">Paid ${escape(paid)}</td></tr>` : ''}
</table>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(page.heading)}</title></head>
<body style="margin: 0; padding: 0; background: ${color['cream-100']};">
<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escape(page.lead(firstName))} Order ${code}, pick-up ${escape(pickup)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${color['cream-100']};">
<tr><td align="center" style="padding: 32px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 480px; background: ${color.paper}; border-radius: 16px; font-family: ${FONT}; font-size: 16px; line-height: 1.5; color: ${color.ink};">
<tr><td style="padding: 28px 28px 0; font-weight: 600; color: ${color.blue};">${escape(store.name)}</td></tr>
<tr><td style="padding: 20px 28px 0;">
<h1 style="margin: 0 0 8px; font-size: 26px; line-height: 1.2; font-weight: 600;">${escape(page.heading)}</h1>
<p style="margin: 0 0 24px;">${escape(page.lead(firstName))}</p>
<p style="margin: 0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: ${color.muted};">Order code</p>
<p style="margin: 0 0 16px; font-size: 32px; font-weight: 700; letter-spacing: 0.06em; color: ${color.blue};">${code}</p>
<p style="margin: 0 0 4px;"><strong>Pick-up</strong> ${escape(pickup)}</p>
<p style="margin: 0 0 24px; color: ${color.muted};">${escape(store.name)}, ${store.address.map(escape).join(', ')}</p>
${note ? `<p style="margin: 0 0 24px; padding: 12px 16px; border-radius: 12px; background: ${color['cream-100']};"><strong>Your note</strong><br>${escape(note)}</p>` : ''}
${rows}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;"><tr><td style="padding: 14px 28px; border-radius: 999px; background: ${color.blue};">
<a href="${escape(link)}" style="display: inline-block; font-weight: 600; color: ${color.paper}; text-decoration: none;">${escape(page.action)}</a>
</td></tr></table>
<p style="margin: 0 0 8px;">${escape(page.after)}</p>
<p style="margin: 0 0 28px; color: ${color.muted};">Questions? Call <a href="${escape(store.phone.href)}" style="color: ${color.blue};">${escape(store.phone.display)}</a>.</p>
</td></tr>
<tr><td style="padding: 20px 28px 28px; border-top: 1px solid ${color.rule}; color: ${color.muted}; font-size: 14px;">${escape(store.signOff)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return {subject: page.subject(code, pickup), text, html};
}
