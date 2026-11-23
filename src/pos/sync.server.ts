// Wires the StoreHub sweep (./sync.ts) to the Worker: the order store, the shop's StoreHub
// account and the alert email.
import {ordersRepo} from '../orders/repo.server';
import {storefront} from '../site/content';
import {storehub} from '../site/pos';
import {sendAlert} from '../ops/alert.server';
import {posSyncOn} from './status';
import {syncPos} from './sync';
import {storehubClient} from './storehub.server';

type SyncEnv = {DB: D1Database; SHOP_ID: string; PAYMENTS: string; STOREHUB_API_TOKEN: string};

const PACE_MS = 400;

export async function syncPosSales(env: SyncEnv) {
  if (!posSyncOn(env.PAYMENTS)) return;
  if (!env.STOREHUB_API_TOKEN) {
    await sendAlert({
      key: 'storehub-auth',
      subject: 'STOREHUB_API_TOKEN is not set on the Worker',
      body: 'No web sale can reach StoreHub until it is set: cf workers secrets update STOREHUB_API_TOKEN --worker cakejalantiung\n\nSales waiting are sent on the next run after that; none are lost.',
    });
    return;
  }
  await syncPos({
    ledger: ordersRepo(env.DB, env.SHOP_ID),
    pos: storehubClient({username: storehub.username, token: env.STOREHUB_API_TOKEN}),
    shop: {storeId: storehub.storeId, paymentMethod: storehub.paymentMethod, products: storehub.products, timeZone: storefront.timeZone},
    alert: (alert) => sendAlert(alert),
    now: () => new Date(),
    pause: () => new Promise((resolve) => setTimeout(resolve, PACE_MS)),
  });
}
