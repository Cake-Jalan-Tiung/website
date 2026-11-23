// CHIP Collect (https://docs.chip-in.asia). Written from the API docs; not yet run against
// CHIP's test mode, which needs the shop's test secret key and brand id.
import {fromBase64} from '../lib/base64';
import {isRecord} from '../lib/guards';
import type {MethodKind, PaymentMethod, PaymentProvider, PaymentState} from './provider';

const API = 'https://gate.chip-in.asia/api/v1';

const KINDS: Record<string, MethodKind> = {
  fpx: 'fpx',
  duitnow_qr: 'duitnow',
  dnqr: 'duitnow',
  razer_tng: 'tng',
  razer_grabpay: 'grabpay',
  shopee_pay: 'shopeepay',
  razer_shopeepay: 'shopeepay',
  visa: 'card',
  mastercard: 'card',
  maestro: 'card',
  mpgs_apple_pay: 'applepay',
  mpgs_google_pay: 'googlepay',
};

const STATES: Record<string, PaymentState> = {
  paid: 'paid',
  cleared: 'paid',
  settled: 'paid',
  expired: 'expired',
  error: 'failed',
  blocked: 'failed',
  cancelled: 'failed',
  refunded: 'refunded',
};

type ChipPurchase = {id: string; status: string; reference?: string; checkout_url: string};

function parsePurchase(value: unknown): ChipPurchase {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string' && typeof value.checkout_url === 'string') {
    return {id: value.id, status: value.status, checkout_url: value.checkout_url, reference: typeof value.reference === 'string' ? value.reference : undefined};
  }
  throw new Error('CHIP returned an unexpected purchase');
}

const pemToDer = (pem: string) => fromBase64(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));

// Payment methods change rarely; ask CHIP at most once every few minutes per amount.
const METHODS_TTL_MS = 5 * 60_000;

export function chipProvider({secretKey, brandId}: {secretKey: string; brandId: string}): PaymentProvider {
  if (!secretKey || !brandId) throw new Error('CHIP needs CHIP_SECRET_KEY and CHIP_BRAND_ID');

  async function call(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json', ...init?.headers},
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`CHIP ${path} failed (${response.status}): ${text.slice(0, 500)}`);
    return JSON.parse(text);
  }

  const methodsCache = new Map<number, {at: number; methods: Promise<PaymentMethod[]>}>();
  let publicKey: Promise<CryptoKey> | undefined;
  const callbackKey = () =>
    (publicKey ??= call('/public_key/').then((pem) => {
      if (typeof pem !== 'string') throw new Error('CHIP public key is not a string');
      return crypto.subtle.importKey('spki', pemToDer(pem), {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
    }));

  const state = async (purchaseId: string): Promise<PaymentState> => {
    const purchase = parsePurchase(await call(`/purchases/${encodeURIComponent(purchaseId)}/`));
    return STATES[purchase.status] ?? 'pending';
  };

  return {
    methods(amountSen) {
      const cached = methodsCache.get(amountSen);
      if (cached && Date.now() - cached.at < METHODS_TTL_MS) return cached.methods;
      const methods = call(`/payment_methods/?brand_id=${encodeURIComponent(brandId)}&currency=MYR&amount=${amountSen}`).then((body) => {
        if (!isRecord(body) || !Array.isArray(body.available_payment_methods)) return [];
        const names = isRecord(body.names) ? body.names : {};
        return body.available_payment_methods
          .filter((id): id is string => typeof id === 'string')
          .map((id): PaymentMethod => ({id, kind: KINDS[id] ?? 'other', name: typeof names[id] === 'string' ? names[id] : id}));
      });
      methods.catch(() => methodsCache.delete(amountSen));
      methodsCache.set(amountSen, {at: Date.now(), methods});
      return methods;
    },

    async createCheckout({orderId, lines, customer, method, dueAt, returnUrl, callbackUrl}) {
      const purchase = parsePurchase(
        await call('/purchases/', {
          method: 'POST',
          body: JSON.stringify({
            brand_id: brandId,
            reference: orderId,
            client: {email: customer.email, full_name: customer.name, phone: customer.phone},
            purchase: {
              currency: 'MYR',
              products: lines.map((line) => ({name: line.name, price: line.unitSen, quantity: String(line.quantity)})),
              due: Math.floor(dueAt.getTime() / 1000),
              due_strict: true,
            },
            success_redirect: returnUrl,
            failure_redirect: returnUrl,
            cancel_redirect: returnUrl,
            success_callback: callbackUrl,
          }),
        }),
      );
      const url = new URL(purchase.checkout_url);
      url.searchParams.set('preferred', method);
      return {purchaseId: purchase.id, redirectUrl: url.toString()};
    },

    async confirm(rawBody, headers) {
      const signature = headers.get('X-Signature');
      if (!signature) return null;
      const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        await callbackKey(),
        fromBase64(signature),
        new TextEncoder().encode(rawBody),
      );
      if (!valid) return null;
      const event: unknown = JSON.parse(rawBody);
      if (!isRecord(event) || typeof event.id !== 'string') return null;
      const purchase = parsePurchase(await call(`/purchases/${encodeURIComponent(event.id)}/`));
      if (!purchase.reference) return null;
      const kind = typeof event.event_type === 'string' ? event.event_type : purchase.status;
      return {eventId: `${purchase.id}:${kind}`, purchaseId: purchase.id, orderId: purchase.reference, state: STATES[purchase.status] ?? 'pending'};
    },

    state,
  };
}
