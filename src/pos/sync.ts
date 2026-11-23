// The sweep that keeps StoreHub in step with paid web orders, run by the Worker's cron trigger.
// Each run records sold orders StoreHub has not seen and cancels the sales of refunded ones;
// anything that fails is left unmarked and tried again on the next run. A failure that would
// repeat for every sale (a wrong token, StoreHub down or asking us to slow down) ends the run
// after one call instead of twenty.
import type {Alert} from '../ops/alert.server';
import {orderCode} from '../orders/model';
import {storehubTransaction, type PosSale, type PosShop} from './sale';
import {StorehubError, type StorehubClient} from './storehub.server';

/** What the sweep reads and marks in the order store. */
export type PosLedger = {
  posUnrecorded(limit: number): Promise<PosSale[]>;
  posUncancelled(limit: number): Promise<string[]>;
  markPos(id: string, step: 'recorded' | 'cancelled', at: Date): Promise<void>;
};

export type PosSyncDeps = {
  ledger: PosLedger;
  pos: StorehubClient;
  shop: PosShop;
  alert: (alert: Alert) => Promise<void>;
  now: () => Date;
  /** Waits between StoreHub calls, to stay under its rate limit. */
  pause: () => Promise<void>;
};

/** Most orders handled per run; a run every few minutes clears far more than the shop sells. */
const PER_RUN = 20;

type Step = {action: 'record' | 'cancel'; orderId: string};

/** The alert for a failed call, and whether the rest of the run can still go ahead. */
export function posFailure(error: unknown, {action, orderId}: Step): {alert: Alert; continues: boolean} {
  const code = orderCode(orderId);
  const retry = 'It is tried again every 5 minutes.';
  if (error instanceof StorehubError && (error.status === 401 || error.status === 403)) {
    return {
      continues: false,
      alert: {
        key: 'storehub-auth',
        subject: 'StoreHub refused the API token',
        body: `No web sale can reach StoreHub until this is fixed: ${error.message}\n\nCheck the token StoreHub issued for the API, then set it again: cf workers secrets update STOREHUB_API_TOKEN --worker cakejalantiung\n\nSales waiting are sent on the next run after that; none are lost. The kitchen board shows how many are waiting.`,
      },
    };
  }
  if (error instanceof StorehubError && !error.refusedThisSale) {
    return {
      continues: false,
      alert: {
        key: 'storehub-unavailable',
        subject: 'StoreHub did not take web sales',
        body: `StoreHub ${error.status === 429 ? 'asked us to slow down' : 'did not answer properly'} while trying to ${action} order ${code}: ${error.message}\n\n${retry} If it lasts, the kitchen board shows how many sales are waiting.`,
      },
    };
  }
  return {
    continues: true,
    alert: {
      key: `storehub-${action}:${orderId}`,
      subject: action === 'record' ? `StoreHub refused the sale for order ${code}` : `StoreHub would not cancel the sale for refunded order ${code}`,
      body: `${error instanceof Error ? error.message : String(error)}\n\n${retry} The same answer will come back each time until the cause is fixed: a dish missing from src/site/pos.ts, a product removed in StoreHub, or a sale StoreHub does not have.${action === 'cancel' ? ' Until then StoreHub still counts the sale; it can be cancelled by hand in StoreHub.' : ''}`,
    },
  };
}

export async function syncPos({ledger, pos, shop, alert, now, pause}: PosSyncDeps): Promise<void> {
  const run = async (step: Step, call: () => Promise<void>) => {
    try {
      await call();
    } catch (error) {
      const failure = posFailure(error, step);
      await alert(failure.alert);
      return failure.continues;
    }
    // StoreHub has the change. If marking it fails the run throws and the scheduled job alerts;
    // the next run repeats the call, which StoreHub ignores for a refId it already has.
    await ledger.markPos(step.orderId, step.action === 'record' ? 'recorded' : 'cancelled', now());
    return true;
  };

  for (const sale of await ledger.posUnrecorded(PER_RUN)) {
    if (!(await run({action: 'record', orderId: sale.orderId}, () => pos.recordSale(storehubTransaction(sale, shop))))) return;
    await pause();
  }
  for (const id of await ledger.posUncancelled(PER_RUN)) {
    if (!(await run({action: 'cancel', orderId: id}, () => pos.cancelSale(id, now())))) return;
    await pause();
  }
}
