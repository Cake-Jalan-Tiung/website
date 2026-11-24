// Lalamove API v3 (https://developers.lalamove.com). Written from the API reference and Lalamove's
// webhook tutorial (April 2026); not yet run against the sandbox, which needs the shop's keys.
// The key's prefix picks the host: pk_test for the sandbox, pk_prod for production.
import {isRecord, textAt} from '../lib/guards';
import {CourierError, type Booking, type Courier, type CourierQuote, type Driver, type Stop, type Tracking} from './courier';
import type {CourierStatus} from './model';

const HOSTS = {sandbox: 'https://rest.sandbox.lalamove.com', production: 'https://rest.lalamove.com'} as const;
const MARKET = 'MY';
const LANGUAGE = 'en_MY';
/** Lalamove's calls answer fast; a slow one fails here and the job tries again. */
const TIMEOUT_MS = 15_000;

const STATUSES: Record<string, CourierStatus> = {
  ASSIGNING_DRIVER: 'finding_rider',
  ON_GOING: 'rider_assigned',
  PICKED_UP: 'picked_up',
  COMPLETED: 'completed',
  CANCELED: 'gave_up',
  CANCELLED: 'gave_up',
  REJECTED: 'gave_up',
  EXPIRED: 'gave_up',
};

/** Lalamove's refusals that trying again will not fix. Anything else is worth another try. */
const REFUSALS: Record<string, string> = {
  ERR_OUT_OF_SERVICE_AREA: 'Lalamove does not serve this address.',
  ERR_INSUFFICIENT_CREDIT: 'The Lalamove wallet has too little credit. Top it up in the Partner Portal.',
  ERR_INVALID_PHONE_NUMBER: 'Lalamove refused a phone number.',
  ERR_INVALID_SERVICE_TYPE: 'Lalamove does not offer this service here. Check `service` in content.ts.',
  ERR_INVALID_MARKET: 'The Lalamove key is not for Malaysia.',
  ERR_REVERSE_GEOCODE_FAILURE: 'Lalamove could not place this address on its map.',
};

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}

/** The string Lalamove signs, for requests and for its webhooks alike. */
export const signedText = (timestamp: string, method: string, path: string, body: string) => `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;

/** "12.5" or 12.5 in ringgit → 1250 sen; NaN when it is neither. */
export const toSen = (value: unknown) => Math.round(Number(typeof value === 'number' || typeof value === 'string' ? value : NaN) * 100);

/** The error id in either of Lalamove's two error shapes. */
export function errorId(body: unknown): string {
  if (isRecord(body) && Array.isArray(body.errors)) return textAt(body.errors[0], 'id');
  return textAt(body, 'message');
}

const data = (body: unknown): Record<string, unknown> => (isRecord(body) && isRecord(body.data) ? body.data : {});

export function lalamoveCourier({key, secret}: {key: string; secret: string}): Courier {
  if (!key || !secret) throw new Error('Lalamove needs LALAMOVE_API_KEY and LALAMOVE_API_SECRET');
  const host = key.startsWith('pk_prod') ? HOSTS.production : HOSTS.sandbox;

  async function call(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<{status: number; body: unknown}> {
    const text = body === undefined ? '' : JSON.stringify(body);
    const timestamp = String(Date.now());
    const signature = await hmac(secret, signedText(timestamp, method, path, text));
    let response: Response;
    try {
      response = await fetch(`${host}${path}`, {
        method,
        headers: {
          Authorization: `hmac ${key}:${timestamp}:${signature}`,
          Market: MARKET,
          'Request-ID': crypto.randomUUID(),
          'Content-Type': 'application/json',
        },
        body: text || undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new CourierError(`Lalamove could not be reached: ${String(error)}`, 'retry');
    }
    const raw = await response.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = raw;
    }
    if (response.ok || response.status === 409) return {status: response.status, body: parsed};
    const id = errorId(parsed);
    const words = REFUSALS[id];
    // 401 and 403 are a wrong or revoked key: nothing a retry fixes.
    const refused = words !== undefined || response.status === 401 || response.status === 403 || response.status === 422;
    throw new CourierError(`${words ?? `Lalamove ${method} ${path} failed`} (${response.status}${id ? ` ${id}` : ''})`, refused ? 'refused' : 'retry', response.status);
  }

  type Priced = CourierQuote & {quotationId: string; fromStop: string; toStop: string};

  async function quotation(from: Stop, to: Stop, service: string, at: Date | null): Promise<Priced> {
    const stop = (s: Stop) => ({coordinates: {lat: String(s.place.lat), lng: String(s.place.lng)}, address: s.address});
    const {body} = await call('POST', '/v3/quotations', {
      data: {serviceType: service, language: LANGUAGE, stops: [stop(from), stop(to)], ...(at ? {scheduleAt: at.toISOString()} : {})},
    });
    const quote = data(body);
    const price = isRecord(quote.priceBreakdown) ? quote.priceBreakdown : {};
    const stops = Array.isArray(quote.stops) ? quote.stops : [];
    const stopId = (index: number) => {
      const value = isRecord(stops[index]) ? stops[index].stopId : undefined;
      return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    };
    const feeSen = toSen(price.total);
    const distanceM = Number(isRecord(quote.distance) ? quote.distance.value : NaN);
    const quotationId = textAt(quote, 'quotationId');
    if (!quotationId || !Number.isFinite(feeSen) || feeSen <= 0 || !Number.isFinite(distanceM) || !stopId(0) || !stopId(1)) {
      throw new CourierError('Lalamove returned a quotation this site cannot read', 'retry');
    }
    return {quotationId, feeSen, distanceM: Math.round(distanceM), fromStop: stopId(0), toStop: stopId(1)};
  }

  async function driver(courierOrderId: string, driverId: string): Promise<Driver | null> {
    try {
      const {status, body} = await call('GET', `/v3/orders/${encodeURIComponent(courierOrderId)}/drivers/${encodeURIComponent(driverId)}`);
      if (status !== 200) return null;
      const found = data(body);
      const name = textAt(found, 'name');
      return name ? {name, phone: textAt(found, 'phone'), plate: textAt(found, 'plateNumber')} : null;
    } catch {
      // A driver's details open an hour before collection; until then the booking stands without them.
      return null;
    }
  }

  return {
    async quote(from, to, service) {
      const {feeSen, distanceM} = await quotation(from, to, service, null);
      return {feeSen, distanceM};
    },

    async book(request, service): Promise<Booking> {
      const priced = await quotation(request.from, request.to, service, request.at);
      // From here a failure may still have booked the ride: only a refusal or a rate limit proves it did not.
      const placed = await call('POST', '/v3/orders', {
        data: {
          quotationId: priced.quotationId,
          sender: {stopId: priced.fromStop, name: request.sender.name, phone: request.sender.phone},
          recipients: [{stopId: priced.toStop, name: request.recipient.name, phone: request.recipient.phone, remarks: request.remarks.replace(/\n/g, '\r\n')}],
          isPODEnabled: false,
          metadata: {reference: request.reference},
        },
      }).catch((error: unknown) => {
        if (error instanceof CourierError && (error.kind === 'refused' || error.status === 429)) throw error;
        throw new CourierError(`Lalamove may or may not have booked this ride: ${error instanceof Error ? error.message : String(error)}`, 'unsure');
      });
      const order = data(placed.body);
      const courierOrderId = textAt(order, 'orderId');
      if (!courierOrderId) throw new CourierError('Lalamove answered the booking without an order id; it may or may not have booked this ride', 'unsure');
      const price = isRecord(order.priceBreakdown) ? order.priceBreakdown : {};
      const costSen = toSen(price.total);
      return {
        courierOrderId,
        shareLink: textAt(order, 'shareLink') || null,
        costSen: Number.isFinite(costSen) ? costSen : priced.feeSen,
        status: STATUSES[textAt(order, 'status')] ?? 'finding_rider',
      };
    },

    async track(courierOrderId): Promise<Tracking> {
      const {body} = await call('GET', `/v3/orders/${encodeURIComponent(courierOrderId)}`);
      const order = data(body);
      const status = STATUSES[textAt(order, 'status')];
      if (!status) throw new CourierError(`Lalamove reported an unknown status "${textAt(order, 'status')}"`, 'retry');
      const driverId = textAt(order, 'driverId');
      return {status, shareLink: textAt(order, 'shareLink') || null, driver: driverId && status !== 'gave_up' ? await driver(courierOrderId, driverId) : null};
    },

    async cancel(courierOrderId) {
      const {status} = await call('DELETE', `/v3/orders/${encodeURIComponent(courierOrderId)}`);
      return status !== 409;
    },

    async confirm(rawBody, path) {
      let event: unknown;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return null;
      }
      if (!isRecord(event) || event.apiKey !== key) return null;
      // Lalamove signs the timestamp (seconds), the method, the path and the `data` object as JSON.
      const timestamp = typeof event.timestamp === 'number' || typeof event.timestamp === 'string' ? String(event.timestamp) : '';
      const expected = await hmac(secret, signedText(timestamp, 'POST', path, JSON.stringify(event.data ?? {})));
      if (!timestamp || textAt(event, 'signature') !== expected) return null;
      const order = isRecord(event.data) && isRecord(event.data.order) ? event.data.order : null;
      return textAt(order, 'orderId') || null;
    },
  };
}
