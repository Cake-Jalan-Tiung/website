import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {toBase64} from '../lib/base64';
import {chipProvider} from './chip.server';

let keys: CryptoKeyPair;
let pem: string;

beforeAll(async () => {
  keys = await crypto.subtle.generateKey(
    {name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'},
    true,
    ['sign', 'verify'],
  );
  const spki = await crypto.subtle.exportKey('spki', keys.publicKey);
  pem = `-----BEGIN PUBLIC KEY-----\n${toBase64(spki).match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
});

afterEach(() => vi.unstubAllGlobals());

/** Stands in for CHIP's API: its public key, and one purchase in the given status. */
function stubChip(status: string) {
  const requests: {url: string; body?: string}[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    requests.push({url, body: typeof init?.body === 'string' ? init.body : undefined});
    const json = (body: unknown) => new Response(JSON.stringify(body), {status: 200});
    if (url.endsWith('/public_key/')) return json(pem);
    if (url.includes('/purchases/')) return json({id: 'pur_1', status, reference: 'order-1', checkout_url: 'https://gate.chip-in.asia/p/pur_1/'});
    return new Response('{}', {status: 404});
  });
  return requests;
}

const sign = async (body: string) => toBase64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(body)));
const chip = () => chipProvider({secretKey: 'test-key', brandId: 'brand-1'});

describe('CHIP callbacks', () => {
  const body = JSON.stringify({id: 'pur_1', event_type: 'purchase.paid'});

  it('accepts a signed callback and confirms the state with CHIP', async () => {
    stubChip('paid');
    const event = await chip().confirm(body, new Headers({'X-Signature': await sign(body)}));
    expect(event).toMatchObject({orderId: 'order-1', purchaseId: 'pur_1', state: 'paid', eventId: 'pur_1:purchase.paid'});
  });

  it('refuses a body that does not match its signature', async () => {
    stubChip('paid');
    const tampered = body.replace('pur_1', 'pur_2');
    expect(await chip().confirm(tampered, new Headers({'X-Signature': await sign(body)}))).toBeNull();
  });

  it('refuses a callback with no signature', async () => {
    stubChip('paid');
    expect(await chip().confirm(body, new Headers())).toBeNull();
  });

  it('reports what CHIP says, not what the callback claims', async () => {
    stubChip('expired');
    const event = await chip().confirm(body, new Headers({'X-Signature': await sign(body)}));
    expect(event?.state).toBe('expired');
  });
});

describe('CHIP checkout', () => {
  it('sends prices in sen and opens the chosen method directly', async () => {
    const requests = stubChip('created');
    const checkout = await chip().createCheckout({
      orderId: 'order-1',
      lines: [{dishId: 'shio-pan', name: 'Shio Pan Salt Bread', unitSen: 1200, quantity: 2}],
      customer: {name: 'Aina', phone: '+60123456789', email: 'a@b.my', note: ''},
      method: 'fpx',
      dueAt: new Date('2026-11-23T08:00:00Z'),
      returnUrl: 'https://shop.example/order/order-1',
      callbackUrl: 'https://shop.example/api/payments/callback',
    });
    expect(checkout.redirectUrl).toBe('https://gate.chip-in.asia/p/pur_1/?preferred=fpx');
    const sent: unknown = JSON.parse(requests[0].body ?? '{}');
    expect(sent).toMatchObject({
      brand_id: 'brand-1',
      reference: 'order-1',
      purchase: {currency: 'MYR', products: [{name: 'Shio Pan Salt Bread', price: 1200, quantity: '2'}], due_strict: true},
    });
  });
});
