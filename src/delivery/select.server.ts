// Which courier this deploy delivers with, if any. DELIVERY is `lalamove`, `fake`, or empty for
// pick-up only. Nothing here throws: a deploy set up wrongly takes pick-up orders as before and
// says why in its log. The Lalamove keys are read as plain secrets, not declared in
// cloudflare.config.ts, so a deploy without them still goes out.
import {textAt} from '../lib/guards';
import type {Storefront} from '../storefront/model';
import {fakeCourier} from './fake.server';
import {lalamoveCourier} from './lalamove.server';
import type {Courier} from './courier';
import type {DeliveryArea, Place} from './model';

export type Delivery = {kind: 'lalamove' | 'fake'; courier: Courier; area: DeliveryArea & {from: Place}};

/** Where the stand-in courier starts when the shop has no pin yet: the middle of Seksyen 4, from OpenStreetMap. Never used for real rides. */
const TEST_SHOP: Place = {lat: 3.0778716, lng: 101.5119499};

let current: {key: string; delivery: Delivery | null} | undefined;

/** The courier and area for this deploy, built once per isolate; null when it does not deliver. */
export function deliverySetup(env: object, store: Storefront): Delivery | null {
  const kind = textAt(env, 'DELIVERY');
  const apiKey = textAt(env, 'LALAMOVE_API_KEY');
  const cacheKey = `${kind}:${apiKey}:${textAt(env, 'PAYMENTS')}:${textAt(env, 'GOOGLE_MAPS_KEY')}`;
  if (current?.key === cacheKey) return current.delivery;
  const area = store.deliveryArea;
  let delivery: Delivery | null = null;
  if (!kind || !area) delivery = null;
  else if (kind === 'fake') {
    // The stand-in takes no money of its own, but it must never sit beside real payments.
    if (textAt(env, 'PAYMENTS') !== 'fake') console.error('DELIVERY=fake needs PAYMENTS=fake; this deploy takes pick-up orders only.');
    else delivery = {kind, courier: fakeCourier, area: {...area, from: area.from ?? TEST_SHOP}};
  } else if (kind === 'lalamove') {
    const secret = textAt(env, 'LALAMOVE_API_SECRET');
    if (!apiKey || !secret) console.error('DELIVERY=lalamove needs LALAMOVE_API_KEY and LALAMOVE_API_SECRET; this deploy takes pick-up orders only.');
    else if (!textAt(env, 'GOOGLE_MAPS_KEY')) console.error('DELIVERY=lalamove needs GOOGLE_MAPS_KEY to find addresses; this deploy takes pick-up orders only.');
    else if (!area.from) console.error('DELIVERY=lalamove needs the shop’s pin (deliveryArea.from in content.ts); this deploy takes pick-up orders only.');
    else delivery = {kind, courier: lalamoveCourier({key: apiKey, secret}), area: {...area, from: area.from}};
  } else console.error(`DELIVERY must be "lalamove", "fake" or empty, not "${kind}"; this deploy takes pick-up orders only.`);
  current = {key: cacheKey, delivery};
  return delivery;
}
