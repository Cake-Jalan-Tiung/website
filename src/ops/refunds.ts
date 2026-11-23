// A refund made in the provider's dashboard sends no callback, and the kitchen board only asks
// about orders still on it. This sweep asks about every sold order of the last month, each every
// few hours, so a refund after collection still reaches the order and, through it, the POS.
import type {Alert} from './alert.server';
import {orderCode, type OrderStatus} from '../orders/model';
import type {PaymentState} from '../payments/provider';

/** How far back a refund is looked for, how often each sold order is asked about, and how many per run. */
export const REFUND_LOOKBACK_DAYS = 30;
export const REFUND_RECHECK_HOURS = 6;
const PER_RUN = 10;

export type RefundDeps = {
  orders: {
    refundCheckDue(paidSince: Date, checkedBefore: Date, limit: number): Promise<{id: string; purchaseId: string}[]>;
    markRefundChecked(id: string, at: Date): Promise<void>;
    move(id: string, to: OrderStatus, now: Date): Promise<boolean>;
  };
  provider: {state(purchaseId: string): Promise<PaymentState>};
  alert: (alert: Alert) => Promise<void>;
  now: Date;
};

export async function catchRefunds({orders, provider, alert, now}: RefundDeps): Promise<void> {
  const due = await orders.refundCheckDue(
    new Date(now.getTime() - REFUND_LOOKBACK_DAYS * 86_400_000),
    new Date(now.getTime() - REFUND_RECHECK_HOURS * 3_600_000),
    PER_RUN,
  );
  for (const order of due) {
    let state: PaymentState;
    try {
      state = await provider.state(order.purchaseId);
    } catch (error) {
      // Unmarked, so the same orders come first next run.
      await alert({
        key: 'provider-unreachable',
        subject: 'CHIP could not be reached',
        body: `Checking order ${orderCode(order.id)} for a refund failed: ${String(error)}\n\nRefunds are looked for again on the next run.`,
      });
      return;
    }
    if (state === 'refunded') await orders.move(order.id, 'refunded', now);
    await orders.markRefundChecked(order.id, now);
  }
}
