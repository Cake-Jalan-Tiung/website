import {createFileRoute} from '@tanstack/react-router';
import {env} from 'cloudflare:workers';
import {ordersRepo} from '../../../orders/repo.server';
import {paymentProvider} from '../../../payments/select.server';
import {alertLater} from '../../../ops/alert.server';
import {notifyLater} from '../../../orders/notify.server';
import {dispatchLater} from '../../../delivery/dispatch.server';

/**
 * The payment provider's callback. The event is verified from its raw body and confirmed with
 * the provider, must name a purchase this shop created, and is logged before it moves the order.
 */
export const Route = createFileRoute('/api/payments/callback')({
  server: {
    handlers: {
      POST: async ({request}) => {
        const body = await request.text();
        try {
          // Unverified requests are not alerted: anyone can post here, and the 5-minute check
          // still settles a real payment whose callback was refused.
          const event = await paymentProvider(env).confirm(body, request.headers);
          if (!event) return new Response('unverified', {status: 401});
          const applied = await ordersRepo(env.DB, env.SHOP_ID).applyPayment(event, body, new Date());
          if (applied) {
            notifyLater(event.orderId);
            // A delivery due soon gets its rider now rather than at the next 5-minute run.
            if (event.state === 'paid') dispatchLater(event.orderId);
            return new Response('ok');
          }
          alertLater({
            key: `callback-unknown:${event.purchaseId}`,
            subject: 'A verified CHIP payment names no order on this site',
            body: `CHIP purchase ${event.purchaseId} (reference ${event.orderId}, ${event.state}) passed the signature check but matches no order here. Look it up in the CHIP portal: it may belong to another site on the same CHIP account.`,
          });
          return new Response('unknown order', {status: 404});
        } catch (error) {
          alertLater({
            key: 'callback-error',
            subject: 'A CHIP payment callback failed',
            body: `The callback threw: ${String(error)}\n\nCHIP retries, and the 5-minute check settles the payment anyway. If this repeats, check the Worker's logs.`,
          });
          return new Response('error', {status: 500});
        }
      },
    },
  },
});
