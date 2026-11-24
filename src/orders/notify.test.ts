import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import type {Alert} from '../ops/alert.server';
import {orderEmail, type EmailOrder, type OrderEmail} from './email';
import {EMAIL_ATTEMPTS, notifyOrder, type NotifyDeps} from './notify';
import type {OrderStatus} from './model';

const now = new Date('2026-11-27T05:00:00.000Z');
const ID = 'k3f9qa00-0000-4000-8000-000000000000';

const order = (status: OrderStatus, extra: Partial<EmailOrder> = {}): EmailOrder & {email: string} => ({
  id: ID,
  status,
  pickupAt: '2026-11-27T06:15:00.000Z',
  paidAt: '2026-11-27T04:52:00.000Z',
  customer: {name: '<b>Aina</b> Rahman', note: 'Write "Selamat Hari Jadi <Aisyah>" on the cake'},
  items: [
    {dishId: 'croissant', name: 'Croissant', unitSen: 900, quantity: 2},
    {dishId: 'latte', name: 'Latte / Cappuccino / Flat White', unitSen: 1250, quantity: 1},
  ],
  totalSen: 3050,
  arrivedAt: null,
  email: 'aina@example.com',
  ...extra,
});

/** Claims kept as the table keeps them: one row per order and kind, retried only after a failure, a few times at most. */
function setup(current: EmailOrder & {email: string}, fail: (email: OrderEmail) => Error | null = () => null) {
  const rows = new Map<string, {state: string; attempts: number}>();
  const sent: {to: string; email: OrderEmail}[] = [];
  const alerts: Alert[] = [];
  const deps: NotifyDeps = {
    order: async () => current,
    emails: {
      claim: async (orderId, kind) => {
        const row = rows.get(`${orderId}:${kind}`);
        if (row && (row.state !== 'failed' || row.attempts >= EMAIL_ATTEMPTS)) return null;
        const attempts = (row?.attempts ?? 0) + 1;
        rows.set(`${orderId}:${kind}`, {state: 'sending', attempts});
        return attempts;
      },
      finish: async (orderId, kind, outcome) => {
        const row = rows.get(`${orderId}:${kind}`);
        if (row) row.state = outcome;
      },
    },
    send: async (to, email) => {
      const error = fail(email);
      if (error) throw error;
      sent.push({to, email});
    },
    alert: async (alert) => void alerts.push(alert),
    store: storefront,
    origin: 'https://cakejalantiung.app',
    now,
  };
  return {deps, rows, sent, alerts};
}

describe('notifyOrder', () => {
  it('sends a paid order one receipt, however many times it is asked', async () => {
    const {deps, sent} = setup(order('paid'));
    await notifyOrder(ID, deps);
    await notifyOrder(ID, deps);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('aina@example.com');
    expect(sent[0].email.subject).toBe('Receipt for order K3F9QA · pick-up Fri 27 Nov, 2:15pm');
  });

  it('sends the ready note once the order is ready, and the receipt with it if that was missed', async () => {
    const {deps, sent} = setup(order('ready'));
    await notifyOrder(ID, deps);
    expect(sent.map((s) => s.email.subject)).toEqual(['Receipt for order K3F9QA · pick-up Fri 27 Nov, 2:15pm', 'Order K3F9QA is ready to collect']);
  });

  it('sends no ready note to a customer already at the counter', async () => {
    const {deps, sent} = setup(order('ready', {arrivedAt: '2026-11-27T06:00:00.000Z'}));
    await notifyOrder(ID, deps);
    expect(sent.map((s) => s.email.subject)).toEqual(['Receipt for order K3F9QA · pick-up Fri 27 Nov, 2:15pm']);
  });

  it('sends nothing for an order not paid, or refunded', async () => {
    for (const status of ['awaiting_payment', 'expired', 'cancelled', 'refunded'] as const) {
      const {deps, sent} = setup(order(status));
      await notifyOrder(ID, deps);
      expect(sent, status).toEqual([]);
    }
  });

  it('retries a failed send a few times, then gives up, alerting without the address', async () => {
    const {deps, sent, alerts, rows} = setup(order('paid'), () => new Error('aina@example.com is suppressed'));
    for (let run = 0; run < EMAIL_ATTEMPTS + 2; run++) await notifyOrder(ID, deps);
    expect(sent).toEqual([]);
    expect(rows.get(`${ID}:paid`)).toEqual({state: 'failed', attempts: EMAIL_ATTEMPTS});
    expect(alerts).toHaveLength(EMAIL_ATTEMPTS);
    expect(alerts[0].body).toContain('K3F9QA');
    expect(alerts.map((alert) => alert.body).join()).not.toContain('aina@example.com');
    // Retries share one held-back alert; giving up is alerted for this order alone.
    expect(alerts.slice(0, -1).every((alert) => alert.key === 'order-email:paid')).toBe(true);
    expect(alerts.at(-1)?.key).toBe(`order-email:paid:${ID}`);
    expect(alerts.at(-1)?.subject).toContain('given up');
  });

  it('never throws, even when the order cannot be read', async () => {
    const {deps} = setup(order('paid'));
    await expect(notifyOrder(ID, {...deps, order: async () => Promise.reject(new Error('D1 down'))})).resolves.toBeUndefined();
  });
});

describe('orderEmail', () => {
  const receipt = orderEmail('paid', order('paid'), storefront, 'https://cakejalantiung.app');
  const ready = orderEmail('ready', order('ready'), storefront, 'https://cakejalantiung.app');

  it('lists what was bought on the receipt, and links to the order', () => {
    expect(receipt.text).toContain('2 × Croissant  RM 18.00');
    expect(receipt.text).toContain('Total  RM 30.50');
    expect(receipt.text).toContain(`https://cakejalantiung.app/order/${ID}`);
    expect(receipt.html).toContain(`href="https://cakejalantiung.app/order/${ID}"`);
  });

  it('keeps the ready note to the code, the time and the way in', () => {
    expect(ready.text).not.toContain('Croissant');
    expect(ready.text).toContain('Order code: K3F9QA');
    expect(ready.text).toContain('Open your order: https://cakejalantiung.app/order/');
    expect(ready.text).not.toContain('Selamat');
  });

  it('repeats the customer’s note and the paid time on the receipt', () => {
    expect(receipt.text).toContain('Your note: Write "Selamat Hari Jadi <Aisyah>" on the cake');
    expect(receipt.html).toContain('Selamat Hari Jadi &lt;Aisyah&gt;');
    expect(receipt.text).toContain('Paid Fri 27 Nov, 12:52pm');
  });

  it('escapes what the customer typed, and keeps it out of the subject', () => {
    expect(receipt.html).not.toContain('<b>Aina');
    expect(receipt.html).toContain('&lt;b&gt;Aina&lt;/b&gt;');
    expect(receipt.subject).not.toContain('Aina');
  });

  it('draws the brand from the site itself: the lockup, the ready note’s Burung Tiung, Jost', () => {
    expect(receipt.html).toContain('src="https://cakejalantiung.app/email/lockup.png"');
    expect(receipt.html).not.toContain('/email/tiung.png');
    expect(ready.html).toContain('src="https://cakejalantiung.app/email/tiung.png"');
    expect(receipt.html).toContain("url('https://cakejalantiung.app/email/jost.woff2')");
    expect(receipt.html).toContain("url('https://cakejalantiung.app/email/PaperMono-Regular.woff2')");
  });

  it('names the registered company on both emails', () => {
    for (const email of [receipt, ready]) {
      expect(email.html).toContain('CJT Bakery Sdn. Bhd.');
      expect(email.text).toContain('CJT Bakery Sdn. Bhd.');
    }
  });

  it('writes the pick-up date out, since an email is read later', () => {
    expect(receipt.text).toContain('Pick-up: Fri 27 Nov, 2:15pm');
    expect(receipt.text).not.toMatch(/today|tomorrow/i);
  });
});
