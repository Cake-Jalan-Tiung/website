import {createFileRoute} from '@tanstack/react-router';
import {env, waitUntil} from 'cloudflare:workers';
import {storefront} from '../../../site/content';
import {deliverySetup} from '../../../delivery/select.server';
import {followBooking} from '../../../delivery/dispatch.server';

const PATH = '/api/delivery/callback';

/**
 * The courier's webhook. It always answers 200, even to an empty probe or a bad signature:
 * Lalamove turns a webhook off after ten failures, and a lost update is caught by the 5-minute
 * job anyway. A proven event only names a booking; the booking itself is read from the courier.
 */
export const Route = createFileRoute('/api/delivery/callback')({
  server: {
    handlers: {
      POST: async ({request}) => {
        const body = await request.text();
        const setup = deliverySetup(env, storefront);
        if (setup && body) {
          waitUntil(
            setup.courier
              .confirm(body, PATH)
              .then((courierOrderId) => (courierOrderId ? followBooking(courierOrderId) : undefined))
              .catch((error: unknown) => console.error('Delivery webhook not followed', error)),
          );
        }
        return new Response('ok');
      },
    },
  },
});
