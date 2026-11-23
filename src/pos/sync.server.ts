// The sweep that keeps StoreHub in step with paid web orders, run by the Worker's cron trigger.
// Each run records sold orders StoreHub has not seen and cancels the sales of refunded ones;
// anything that fails is left unmarked and tried again on the next run.
import {ordersRepo} from '../orders/repo.server';
import {storefront} from '../site/content';
import {storehub} from '../site/pos';
import {storehubTransaction} from './sale';
import {storehubClient} from './storehub.server';
import {sendAlert} from '../ops/alert.server';
import {orderCode} from '../orders/model';

type SyncEnv = {DB: D1Database; SHOP_ID: string; PAYMENTS: string; STOREHUB_API_TOKEN: string};

/** Most orders handled per run; a run every few minutes clears far more than the shop sells. */
const PER_RUN = 20;
/** Gap between StoreHub calls, to stay under its rate limit. */
const PACE_MS = 400;
const pause = () => new Promise((resolve) => setTimeout(resolve, PACE_MS));

export async function syncPosSales(env: SyncEnv, now: () => Date = () => new Date()) {
  // Only real money becomes a real sale: a deploy on test payments never writes to the POS.
  if (env.PAYMENTS !== 'chip') return;
  const orders = ordersRepo(env.DB, env.SHOP_ID);
  const pos = storehubClient({username: storehub.username, token: env.STOREHUB_API_TOKEN});
  const shop = {storeId: storehub.storeId, products: storehub.products, timeZone: storefront.timeZone};

  for (const sale of await orders.posUnrecorded(PER_RUN)) {
    try {
      await pos.recordSale(storehubTransaction(sale, shop));
      await orders.markPos(sale.orderId, 'recorded', now());
    } catch (error) {
      await sendAlert({
        key: 'storehub-record',
        subject: 'A sale could not be recorded in StoreHub',
        body: `Order ${orderCode(sale.orderId)} was paid, but StoreHub refused or did not answer: ${String(error)}\n\nIt is tried again every 5 minutes. A dish missing from src/site/pos.ts, or a changed StoreHub token, fails every time.`,
      });
    }
    await pause();
  }

  for (const id of await orders.posUncancelled(PER_RUN)) {
    try {
      await pos.cancelSale(id, now());
      await orders.markPos(id, 'cancelled', now());
    } catch (error) {
      await sendAlert({
        key: 'storehub-cancel',
        subject: 'A refunded sale could not be cancelled in StoreHub',
        body: `Order ${orderCode(id)} was refunded, but cancelling its StoreHub sale failed: ${String(error)}\n\nIt is tried again every 5 minutes. Until then StoreHub still counts the sale.`,
      });
    }
    await pause();
  }
}
