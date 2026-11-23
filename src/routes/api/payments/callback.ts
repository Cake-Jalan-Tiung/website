import {createFileRoute} from '@tanstack/react-router';
import {env} from 'cloudflare:workers';
import {ordersRepo} from '../../../orders/repo.server';
import {paymentProvider} from '../../../payments/select.server';

/**
 * The payment provider's callback. The event is verified from its raw body and confirmed with
 * the provider, must name a purchase this shop created, and is logged before it moves the order.
 */
export const Route = createFileRoute('/api/payments/callback')({
  server: {
    handlers: {
      POST: async ({request}) => {
        const body = await request.text();
        const event = await paymentProvider(env).confirm(body, request.headers);
        if (!event) return new Response('unverified', {status: 401});
        const applied = await ordersRepo(env.DB, env.SHOP_ID).applyPayment(event, body, new Date());
        return applied ? new Response('ok') : new Response('unknown order', {status: 404});
      },
    },
  },
});
