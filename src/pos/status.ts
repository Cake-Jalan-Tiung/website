// Where paid web orders stand in StoreHub, as the kitchen board shows it. Pure, so the board's
// wording and the cron's thresholds come from one place.
import type {PricedLine} from '../orders/model';
import {TEST_DISH} from '../orders/model';

/** Only real money becomes a real sale: a deploy on test payments never writes to the POS. */
export const posSyncOn = (payments: string) => payments === 'chip';

/** Two cron runs and a margin. A sale still missing from StoreHub after this needs a person to look. */
export const POS_STUCK_MINUTES = 12;
export const posStuckBefore = (now: Date) => new Date(now.getTime() - POS_STUCK_MINUTES * 60_000);

export const isTestOrder = (items: readonly PricedLine[]) => items.some((item) => item.dishId === TEST_DISH.id);

export type PosState = 'recorded' | 'sending' | 'stuck' | 'not-a-sale';

export function posState(order: {items: readonly PricedLine[]; paidAt: string | null; posRecordedAt: string | null}, now: Date): PosState {
  if (isTestOrder(order.items)) return 'not-a-sale';
  if (order.posRecordedAt) return 'recorded';
  return order.paidAt && order.paidAt < posStuckBefore(now).toISOString() ? 'stuck' : 'sending';
}

/** Sold orders StoreHub should have by now and does not, and refunds it still counts as sales. */
export type PosBacklog = {unrecorded: number; oldestPaidAt: string | null; uncancelled: number};
