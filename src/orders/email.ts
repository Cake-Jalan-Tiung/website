// The two emails a customer gets about an order, and when each is due. A receipt once it is
// paid, then a note once it is ready, which brings them back to the order's page to say
// "I'm here". Pure: the sender, the claims and the retries live in notify.server.ts.
import {color, space, tracking, typeScale, weight, type TypeRole} from '../system/tokens';
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

export type Attachment = {filename: string; type: string; content: Uint8Array};
export type OrderEmail = {subject: string; text: string; html: string; attachments?: readonly Attachment[]};

type Page = {
  subject: (code: string, pickup: string) => string;
  heading: string;
  lead: (firstName: string) => string;
  action: string;
  after: string;
  /** Whether to list what was bought: the receipt does, the ready note only names the code. */
  receipt: boolean;
  /** The ready note's singing Burung Tiung, beside its heading. */
  bird: boolean;
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
      lead: (firstName) => `Thank you, ${firstName}. The kitchen has it.`,
      action: 'Follow your order',
      after: 'We’ll email you again when it’s ready.',
      receipt: true,
      bird: false,
    },
  },
  ready: {
    // Someone already at the counter needs no email to come to it.
    isDue: (order: EmailOrder) => order.status === 'ready' && order.arrivedAt === null,
    page: {
      subject: (code) => `Order ${code} is ready to collect`,
      heading: customerCopy('ready').title,
      lead: (firstName) => `${firstName}, it’s waiting for you at the counter.`,
      action: 'Open your order',
      after: 'When you arrive, tap I’m here on your order page or show this code.',
      receipt: false,
      bird: true,
    },
  },
} as const satisfies Record<string, {isDue: (order: EmailOrder) => boolean; page: Page}>;

export type OrderEmailKind = keyof typeof ORDER_EMAILS;
export const ORDER_EMAIL_KINDS = Object.keys(ORDER_EMAILS).filter((key): key is OrderEmailKind => key in ORDER_EMAILS);

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char] ?? char);

/**
 * The marks as scripts/build-email-art.mjs draws them into public/email/, at the size shown here:
 * mail apps show no SVG. Rerun `pnpm email-art` after changing a size.
 */
const ART = {
  lockup: {src: '/email/lockup.png', width: 240, height: 156, alt: 'Cake Jalan Tiung, baking the world a little sweeter'},
  tiung: {src: '/email/tiung.png', width: 112, height: 119, alt: ''},
  icon: {src: '/email/tiung-icon.png', width: 32, height: 34, alt: ''},
} as const;

/**
 * Jost where the mail app loads web fonts (Apple Mail does); its nearest system cousins elsewhere.
 * Paper Mono (SIL OFL 1.1, public/email/PaperMono-*.woff2 from github.com/paper-design/paper-mono)
 * sets what a till slip would print: labels, the code, times and money. Sentences stay in Jost.
 */
const FONTS = {
  sans: `Jost, Futura, 'Avenir Next', 'Century Gothic', 'Segoe UI', Helvetica, Arial, sans-serif`,
  mono: `'Paper Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`,
} as const;
type Face = keyof typeof FONTS;
/** Mono is wide already: its capitals take less of the site's tracking, and big numbers none of the tightening. */
const MONO_CAPS_TRACKING = 0.08;
/** The card is the site's reading measure with room either side. */
const CARD = 600;
const RULE = 3;

/** A type role from the site's scale, written inline: mail apps drop most stylesheets. Labels are always mono. */
function type(role: TypeRole, ink: string = color.ink, face: Face = role === 'label' ? 'mono' : 'sans') {
  const step = typeScale[role];
  const caps = 'caps' in step && step.caps;
  const spacing = face === 'mono' ? (caps ? `${MONO_CAPS_TRACKING}em` : 'normal') : 'tracking' in step && step.tracking ? `${tracking[step.tracking]}em` : 'normal';
  return [
    face === 'mono' ? `font-family: ${FONTS.mono}` : '',
    `font-size: ${step.size}px`,
    `line-height: ${step.leading}px`,
    `font-weight: ${weight[step.weight]}`,
    `letter-spacing: ${spacing}`,
    caps ? 'text-transform: uppercase' : '',
    `color: ${ink}`,
  ]
    .filter(Boolean)
    .map((declaration) => `${declaration};`)
    .join(' ');
}

const image = (origin: string, art: (typeof ART)[keyof typeof ART]) =>
  `<img src="${escape(origin + art.src)}" width="${art.width}" height="${art.height}" alt="${escape(art.alt)}" style="display: block; border: 0; width: ${art.width}px; height: auto;">`;

/** A section under the site's thick ink rule, with its spaced-capitals label. */
const section = (label: string, body: string) =>
  `<tr><td class="px" style="padding: 0 ${space.lg}px ${space.lg}px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: ${RULE}px solid ${color.ink};"><tr><td style="padding-top: ${space.sm}px;">
<p style="margin: 0 0 ${space.xs}px; ${type('label', color.muted)}">${escape(label)}</p>
${body}
</td></tr></table>
</td></tr>`;

/** The email of this kind for this order. Customer and dish names go into the body only, escaped; the subject holds nothing they typed. */
export function orderEmail(kind: OrderEmailKind, order: EmailOrder, store: Storefront, origin: string, receiptAttached = false): OrderEmail {
  const page: Page = ORDER_EMAILS[kind].page;
  const code = orderCode(order.id);
  const pickup = formatShopDateTime(store.timeZone, order.pickupAt);
  const firstName = order.customer.name.trim().split(/\s+/)[0] || 'there';
  const link = `${origin}/order/${order.id}`;
  const lines = order.items.map((line) => ({label: `${line.quantity} × ${line.name}`, amount: formatRM(line.unitSen * line.quantity)}));
  const plainRM = (value: string) => value.replace(' ', ' ');
  // On the receipt only: the note is what a cake order most needs checked (the words on the cake),
  // and the paid time is what an expense claim asks for.
  const note = page.receipt ? order.customer.note.trim() : '';
  const paid = page.receipt && order.paidAt ? `Paid ${formatShopDateTime(store.timeZone, order.paidAt)}${receiptAttached ? ' · PDF attached' : ''}` : '';
  const address = store.address.join(', ');

  const text = [
    `${store.name}`,
    '',
    page.heading,
    page.lead(firstName),
    '',
    `Order code: ${code}`,
    '',
    `Pick-up: ${pickup}`,
    address,
    `Map: ${store.mapHref}`,
    ...(page.receipt ? ['', 'Your order', ...lines.map((line) => `${line.label}  ${plainRM(line.amount)}`), `Total  ${plainRM(formatRM(order.totalSen))}`] : []),
    ...(paid ? [paid] : []),
    ...(note ? ['', `Your note: ${note}`] : []),
    '',
    `${page.action}: ${link}`,
    '',
    page.after,
    `Questions? Call ${store.phone.display}.`,
    '',
    store.signOff,
    ...(store.legalName ? [store.legalName] : []),
  ].join('\n');

  const heading = `<p style="margin: 0 0 ${space.xs}px; ${type('label', color.muted)}">Order</p>
<p style="margin: 0 0 ${space.sm}px; ${type('head', color.ink, 'mono')}">${code}</p>
<p style="margin: 0 0 ${space.xs}px; ${type('subhead')}">${escape(page.heading)}</p>
<p style="margin: 0; ${type('body')}">${escape(page.lead(firstName))}</p>`;

  const hero = page.bird
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="bottom">${heading}</td>
<td valign="bottom" width="${ART.tiung.width}" style="padding-left: ${space.sm}px;">${image(origin, ART.tiung)}</td>
</tr></table>`
    : heading;

  const cell = `padding: ${space.xs}px 0; border-bottom: 1px solid ${color.rule}; ${type('body')}`;
  const receipt = page.receipt
    ? section(
        'Your order',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
${lines.map((line) => `<tr><td style="${cell}">${escape(line.label)}</td><td align="right" style="${cell} ${type('body', color.ink, 'mono')} white-space: nowrap; padding-left: ${space.sm}px;">${line.amount}</td></tr>`).join('\n')}
<tr><td style="padding-top: ${space.sm}px; ${type('body')} font-weight: ${weight.medium};">Total</td><td align="right" style="padding-top: ${space.sm}px; white-space: nowrap; ${type('subhead', color.ink, 'mono')} font-weight: ${weight.medium};">${formatRM(order.totalSen)}</td></tr>
</table>
${paid ? `<p style="margin: ${space.xs}px 0 0; ${type('caption', color.muted, 'mono')}">${escape(paid)}</p>` : ''}
${note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: ${space.md}px;"><tr><td style="padding: ${space.sm}px; background: ${color['cream-100']};">
<p style="margin: 0 0 ${space.xs}px; ${type('label', color.muted)}">Your note</p>
<p style="margin: 0; ${type('body')}">${escape(note)}</p>
</td></tr></table>` : ''}`,
      )
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escape(page.heading)}</title>
<style>
@font-face { font-family: 'Jost'; font-style: normal; font-weight: 100 900; src: url('${escape(origin)}/email/jost.woff2') format('woff2'); }
@font-face { font-family: 'Paper Mono'; font-style: normal; font-weight: 400; src: url('${escape(origin)}/email/PaperMono-Regular.woff2') format('woff2'); }
@font-face { font-family: 'Paper Mono'; font-style: normal; font-weight: 500; src: url('${escape(origin)}/email/PaperMono-Medium.woff2') format('woff2'); }
:root { color-scheme: light only; }
@media (max-width: ${CARD + space.md}px) {
  .px { padding-left: ${space.md}px !important; padding-right: ${space.md}px !important; }
  .frame { padding: 0 !important; }
}
</style>
</head>
<body style="margin: 0; padding: 0; background: ${color['cream-100']}; -webkit-text-size-adjust: 100%;">
<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escape(page.lead(firstName))} Order ${code}, pick-up ${escape(pickup)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${color['cream-100']};">
<tr><td class="frame" align="center" style="padding: ${space.lg}px ${space.sm}px;">
<table role="presentation" width="${CARD}" cellpadding="0" cellspacing="0" style="width: 100%; max-width: ${CARD}px; background: ${color.paper}; font-family: ${FONTS.sans}; ${type('body')}">

<tr><td class="px" align="center" style="padding: ${space.md}px ${space.lg}px 0; background: ${color['cream-100']};">
<a href="${escape(origin)}" style="text-decoration: none;">${image(origin, ART.lockup)}</a>
</td></tr>

<tr><td class="px" style="padding: ${space.sm}px ${space.lg}px ${space.lg}px; background: ${color['cream-100']};">
${hero}
</td></tr>

<tr><td style="height: ${space.lg}px; line-height: ${space.lg}px; font-size: 0;">&nbsp;</td></tr>

${section(
  'Pick-up',
  `<p style="margin: 0 0 ${space.xs}px; ${type('subhead', color.ink, 'mono')}">${escape(pickup)}</p>
<p style="margin: 0 0 ${space.xs}px; ${type('body')}">${escape(address)}</p>
<p style="margin: 0; ${type('body')}"><a href="${escape(store.mapHref)}" style="color: ${color.blue}; text-decoration: none;">Open in Google Maps ↗</a></p>`,
)}

${receipt}

<tr><td class="px" style="padding: 0 ${space.lg}px ${space.lg}px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background: ${color.blue};">
<a href="${escape(link)}" style="display: block; padding: ${space.sm}px; ${type('body', color.paper)} font-weight: ${weight.medium}; text-decoration: none; text-align: center;">${escape(page.action)}</a>
</td></tr></table>
<p style="margin: ${space.sm}px 0 0; ${type('body')}">${escape(page.after)}</p>
<p style="margin: ${space.xs}px 0 0; ${type('caption', color.muted)}">Questions? Call <a href="${escape(store.phone.href)}" style="color: ${color.blue}; text-decoration: none;">${escape(store.phone.display)}</a>.</p>
</td></tr>

<tr><td class="px" style="padding: ${space.md}px ${space.lg}px ${space.lg}px; border-top: 1px solid ${color.rule};">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="middle" style="padding-right: ${space.sm}px;">${image(origin, ART.icon)}</td>
<td valign="middle">
<p style="margin: 0; ${type('body')}">${escape(store.signOff)}</p>
${store.legalName ? `<p style="margin: 0; ${type('caption', color.muted)}">${escape(store.legalName)}</p>` : ''}
</td>
</tr></table>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return {subject: page.subject(code, pickup), text, html};
}
