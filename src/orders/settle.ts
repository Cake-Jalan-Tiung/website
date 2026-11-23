// A payment whose page never came back (a bank app that kept the customer, a Back tap from the
// payment page) still settles: each order this device went to pay for is asked after, one at a
// time, so a paid bag empties, the order is remembered, and a second payment for the same food
// is not invited.
import {forgetPaying, payingIds, settleBag} from './bag';
import {getOrder, type PublicOrder} from './functions';
import {CUSTOMER_STEPS, isDormant} from './model';
import {rememberOrder} from './recent';

/** The paid order whose bag was still in hand and has now emptied, if any. */
export async function settlePaying(): Promise<PublicOrder | null> {
  let paidFor: PublicOrder | null = null;
  for (const id of payingIds()) {
    let order: PublicOrder | null;
    try {
      order = await getOrder({data: {id}});
    } catch {
      continue;
    }
    if (!order) {
      forgetPaying(id);
      continue;
    }
    if (CUSTOMER_STEPS.some((step) => step.status === order.status)) {
      const settled = settleBag(id);
      rememberOrder(order, settled !== null);
      if (settled === 'cleared') paidFor = order;
    } else if ((isDormant(order.status) || order.status === 'refunded') && Date.now() > Date.parse(order.pickupAt)) {
      // Unpaid long past its pick-up time: nothing more will come of it.
      forgetPaying(id);
    }
  }
  return paidFor;
}
