// The Worker's cron trigger, every 5 minutes: settle orders still waiting for payment, catch
// refunds made in the provider's dashboard, send order emails still owed, then keep the POS in
// step. Each step runs even when the one before it failed.
import {ordersRepo} from '../orders/repo.server';
import {LATE_PAYMENT_HOURS, orderCode, statusAfterAsking} from '../orders/model';
import {paymentProvider} from '../payments/select.server';
import type {PaymentState} from '../payments/provider';
import {syncPosSales} from '../pos/sync.server';
import {sendDueEmails} from '../orders/notify.server';
import {catchRefunds} from './refunds';
import {sendAlert} from './alert.server';

type ScheduledEnv = {DB: D1Database; SHOP_ID: string; PAYMENTS: string; CHIP_SECRET_KEY: string; CHIP_BRAND_ID: string; STOREHUB_API_TOKEN: string} & Parameters<typeof sendDueEmails>[0];

const PER_RUN = 20;

/**
 * Asks the provider about every order still waiting for payment, and for a few hours about those
 * that expired or were cancelled. Money that arrived without its callback moves the order to paid
 * (and onto the kitchen board), even when it came after the window closed; an order whose payment
 * window has passed expires, so nothing is left waiting because a customer closed the page.
 */
export async function settleUnpaid(env: ScheduledEnv, now: Date = new Date()) {
  const orders = ordersRepo(env.DB, env.SHOP_ID);
  const provider = paymentProvider(env);
  for (const order of await orders.awaitingMoney(new Date(now.getTime() - LATE_PAYMENT_HOURS * 3_600_000), PER_RUN)) {
    let state: PaymentState = 'pending';
    if (order.purchaseId) {
      try {
        state = await provider.state(order.purchaseId);
      } catch (error) {
        await sendAlert({
          key: 'provider-unreachable',
          subject: 'CHIP could not be reached',
          body: `Checking the payment for order ${orderCode(order.id)} failed: ${String(error)}\n\nOrders waiting for payment are re-checked every 5 minutes. If CHIP stays unreachable, paid orders may not reach the kitchen board.`,
        });
        continue;
      }
    }
    const to = statusAfterAsking(order.status, state, order.createdAt, now);
    if (to && (await orders.move(order.id, to, now)) && to === 'paid') {
      await sendAlert({
        key: `callback-missed:${order.id}`,
        subject: `Order ${orderCode(order.id)} was paid but its CHIP callback never arrived`,
        body: `CHIP shows order ${orderCode(order.id)} as paid, but its callback did not reach the site. The 5-minute check found it and moved it to paid; it is on the kitchen board now.\n\nOne of these is fine. If they repeat, check the callback URL CHIP is sent (/api/payments/callback) and the Worker's logs.`,
      });
    }
  }
}

export async function runScheduled(env: ScheduledEnv) {
  const steps: [string, () => Promise<void>][] = [
    ['settle unpaid orders', () => settleUnpaid(env)],
    ['catch refunds', () => catchRefunds({orders: ordersRepo(env.DB, env.SHOP_ID), provider: paymentProvider(env), alert: (alert) => sendAlert(alert), now: new Date()})],
    // After settling, so an order the job just found paid gets its receipt in the same run.
    ['send order emails', () => sendDueEmails(env)],
    ['record sales in StoreHub', () => syncPosSales(env)],
  ];
  for (const [name, step] of steps) {
    try {
      await step();
    } catch (error) {
      await sendAlert({key: `scheduled:${name}`, subject: `The scheduled job failed to ${name}`, body: `${String(error)}\n\nIt runs again in 5 minutes.`});
    }
  }
}
