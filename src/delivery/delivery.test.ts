import {afterEach, describe, expect, it, vi} from 'vitest';
import {toBase64Url} from '../lib/base64';
import {arrivesAt, dropOffProblems, formatDistance, isInArea, metresBetween, parseDropOff, stateForCourier, type DeliveryArea} from './model';
import {readQuote, signQuote} from './quote-token.server';
import {errorId, lalamoveCourier, signedText, toSen} from './lalamove.server';
import {CourierError} from './courier';

const SHOP = {lat: 3.0778716, lng: 101.5119499};

/** HMAC-SHA256 as lowercase hex, the way Lalamove signs. */
async function hmacHex(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
const AREA: DeliveryArea = {from: SHOP, radiusKm: 10, service: 'MOTORCYCLE', minutesPerKm: 3, handoverMinutes: 10};

describe('the delivery area', () => {
  it('measures a kilometre north as about 1000 m', () => {
    expect(metresBetween(SHOP, {lat: SHOP.lat + 1 / 111.32, lng: SHOP.lng})).toBeGreaterThan(995);
    expect(metresBetween(SHOP, {lat: SHOP.lat + 1 / 111.32, lng: SHOP.lng})).toBeLessThan(1005);
  });

  it('takes addresses inside the radius and refuses those past it', () => {
    expect(isInArea(AREA, SHOP, {lat: SHOP.lat + 9 / 111.32, lng: SHOP.lng})).toBe(true);
    expect(isInArea(AREA, SHOP, {lat: SHOP.lat + 11 / 111.32, lng: SHOP.lng})).toBe(false);
  });

  it('estimates arrival as the handover plus the ride', () => {
    // 10 minutes to hand over, 6 km at 3 minutes a kilometre.
    expect(arrivesAt(AREA, '2026-11-25T00:00:00.000Z', 6000)).toBe('2026-11-25T00:28:00.000Z');
  });

  it('says distances the way a customer reads them', () => {
    expect(formatDistance(6240)).toBe('6.2 km');
    expect(formatDistance(420)).toBe('400 m');
    expect(formatDistance(20)).toBe('100 m');
  });
});

describe('a drop-off from the browser', () => {
  const good = {address: '12, Jalan Sukun 4/7, Shah Alam', unit: 'No. 12', note: 'Blue gate', place: {lat: 3.1, lng: 101.5}};

  it('needs a found address and a door', () => {
    expect(dropOffProblems({...good, place: null}).address).toMatch(/Find your address/);
    expect(dropOffProblems({...good, unit: ' '}).unit).toMatch(/house or unit/);
    expect(dropOffProblems(good)).toEqual({});
  });

  it('parses trimmed, with the point rounded to six places', () => {
    const parsed = parseDropOff({...good, unit: ' No. 12 ', place: {lat: 3.123456789, lng: '101.5'}}, (message) => new Error(message));
    expect(parsed).toEqual({...good, unit: 'No. 12', place: {lat: 3.123457, lng: 101.5}});
  });

  it('refuses a point that is not one', () => {
    expect(() => parseDropOff({...good, place: {lat: 200, lng: 0}}, (message) => new Error(message))).toThrow(/Find your address/);
  });
});

describe('the courier moving a delivery', () => {
  it('follows the ride forward', () => {
    expect(stateForCourier('finding_rider', 'rider_assigned')).toBe('rider_assigned');
    expect(stateForCourier('rider_assigned', 'picked_up')).toBe('on_the_way');
    expect(stateForCourier('on_the_way', 'completed')).toBe('delivered');
  });

  it('sends a ride the courier gave up on back to be booked', () => {
    expect(stateForCourier('finding_rider', 'gave_up')).toBe('failed');
  });

  it('never moves a delivery that is done, waiting on staff, or not booked', () => {
    expect(stateForCourier('delivered', 'gave_up')).toBeNull();
    expect(stateForCourier('cancelled', 'picked_up')).toBeNull();
    expect(stateForCourier('stuck', 'rider_assigned')).toBeNull();
    expect(stateForCourier('waiting', 'rider_assigned')).toBeNull();
  });

  it('changes nothing when the state is the same', () => {
    expect(stateForCourier('rider_assigned', 'rider_assigned')).toBeNull();
  });
});

describe('the quote token', () => {
  const secret = 'test-secret';
  const now = new Date('2026-11-25T02:00:00Z');
  const place = {lat: 3.1, lng: 101.5};

  it('carries the fee back for the same point within the hour', async () => {
    const token = await signQuote(secret, place, {feeSen: 1220, distanceM: 6000}, now);
    expect(await readQuote(secret, token, place, new Date(now.getTime() + 59 * 60_000))).toEqual({feeSen: 1220, distanceM: 6000});
  });

  it('is refused after an hour, for another point, or once edited', async () => {
    const token = await signQuote(secret, place, {feeSen: 1220, distanceM: 6000}, now);
    expect(await readQuote(secret, token, place, new Date(now.getTime() + 61 * 60_000))).toBeNull();
    expect(await readQuote(secret, token, {lat: 3.2, lng: 101.5}, now)).toBeNull();
    const [payload, signature] = token.split('.');
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const cheaper = toBase64Url(new TextEncoder().encode(decoded.replace('1220', '100')));
    expect(await readQuote(secret, `${cheaper}.${signature}`, place, now)).toBeNull();
    expect(await readQuote('another-secret', token, place, now)).toBeNull();
  });
});

describe('Lalamove', () => {
  afterEach(() => vi.unstubAllGlobals());

  const KEY = 'pk_test_abc';
  const SECRET = 'sk_test_xyz';
  const from = {place: SHOP, address: '9, Jln Sukun 4/7, Shah Alam'};
  const to = {place: {lat: 3.13, lng: 101.51}, address: 'Setia Alam'};

  /** Stands in for Lalamove's API, recording each request with its headers. */
  function stubLalamove(answer: (method: string, path: string) => {status: number; body: unknown}) {
    const requests: {url: string; method: string; headers: Headers; body: string}[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const body = typeof init.body === 'string' ? init.body : '';
      requests.push({url, method: init.method ?? 'GET', headers: new Headers(init.headers), body});
      const path = new URL(url).pathname;
      const reply = answer(init.method ?? 'GET', path);
      return new Response(reply.body === null ? null : JSON.stringify(reply.body), {status: reply.status});
    });
    return requests;
  }

  const quotation = {data: {quotationId: 'Q1', priceBreakdown: {total: '12.5', currency: 'MYR'}, distance: {value: '6012', unit: 'm'}, stops: [{stopId: 'S1'}, {stopId: 'S2'}]}};

  it('signs each request as the API reference says', async () => {
    const requests = stubLalamove(() => ({status: 201, body: quotation}));
    const quote = await lalamoveCourier({key: KEY, secret: SECRET}).quote(from, to, 'MOTORCYCLE');
    expect(quote).toEqual({feeSen: 1250, distanceM: 6012});
    const [request] = requests;
    expect(request.url).toBe('https://rest.sandbox.lalamove.com/v3/quotations');
    expect(request.headers.get('Market')).toBe('MY');
    const [, credentials] = (request.headers.get('Authorization') ?? '').split(' ');
    const [key, timestamp, signature] = credentials.split(':');
    expect(key).toBe(KEY);
    expect(signature).toBe(await hmacHex(SECRET, signedText(timestamp, 'POST', '/v3/quotations', request.body)));
    expect(JSON.parse(request.body).data.stops[1].coordinates).toEqual({lat: '3.13', lng: '101.51'});
  });

  it('uses production for a production key', async () => {
    const requests = stubLalamove(() => ({status: 201, body: quotation}));
    await lalamoveCourier({key: 'pk_prod_abc', secret: SECRET}).quote(from, to, 'MOTORCYCLE');
    expect(requests[0].url.startsWith('https://rest.lalamove.com/')).toBe(true);
  });

  it('books with a fresh quote and the stops it named', async () => {
    const requests = stubLalamove((_method, path) =>
      path === '/v3/quotations' ? {status: 201, body: quotation} : {status: 201, body: {data: {orderId: '1234567890123456789', shareLink: 'https://share.example/1', status: 'ASSIGNING_DRIVER', priceBreakdown: {total: '13.0'}}}},
    );
    const booking = await lalamoveCourier({key: KEY, secret: SECRET}).book(
      {from, to, at: null, sender: {name: 'Shop', phone: '+60128787258'}, recipient: {name: 'Aisyah', phone: '+60123456789'}, remarks: 'No. 12\nBlue gate', reference: 'order-1'},
      'MOTORCYCLE',
    );
    expect(booking).toEqual({courierOrderId: '1234567890123456789', shareLink: 'https://share.example/1', costSen: 1300, status: 'finding_rider'});
    const placed = JSON.parse(requests[1].body).data;
    expect(placed.quotationId).toBe('Q1');
    expect(placed.sender.stopId).toBe('S1');
    expect(placed.recipients[0]).toEqual({stopId: 'S2', name: 'Aisyah', phone: '+60123456789', remarks: 'No. 12\r\nBlue gate'});
  });

  it('tells a refusal from a hiccup', async () => {
    stubLalamove(() => ({status: 422, body: {errors: [{id: 'ERR_OUT_OF_SERVICE_AREA', message: 'out'}]}}));
    const refused = await lalamoveCourier({key: KEY, secret: SECRET}).quote(from, to, 'MOTORCYCLE').catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(CourierError);
    expect(refused instanceof CourierError && refused.kind).toBe('refused');
    stubLalamove(() => ({status: 503, body: {message: 'busy'}}));
    const busy = await lalamoveCourier({key: KEY, secret: SECRET}).quote(from, to, 'MOTORCYCLE').catch((error: unknown) => error);
    expect(busy instanceof CourierError && busy.kind).toBe('retry');
  });

  it('calls a booking that timed out or came back unreadable unsure, and a rate limit a retry', async () => {
    const courier = lalamoveCourier({key: KEY, secret: SECRET});
    const request = {from, to, at: null, sender: {name: 'Shop', phone: '+60128787258'}, recipient: {name: 'Aisyah', phone: '+60123456789'}, remarks: '', reference: 'order-1'};
    const kindOf = (error: unknown) => (error instanceof CourierError ? error.kind : 'not a courier error');
    stubLalamove((_method, path) => (path === '/v3/quotations' ? {status: 201, body: quotation} : {status: 504, body: {message: 'timeout'}}));
    expect(kindOf(await courier.book(request, 'MOTORCYCLE').catch((error: unknown) => error))).toBe('unsure');
    stubLalamove((_method, path) => (path === '/v3/quotations' ? {status: 201, body: quotation} : {status: 201, body: {data: {}}}));
    expect(kindOf(await courier.book(request, 'MOTORCYCLE').catch((error: unknown) => error))).toBe('unsure');
    stubLalamove((_method, path) => (path === '/v3/quotations' ? {status: 201, body: quotation} : {status: 429, body: {message: 'ERR_RATE_LIMIT_EXCEEDED'}}));
    expect(kindOf(await courier.book(request, 'MOTORCYCLE').catch((error: unknown) => error))).toBe('retry');
    stubLalamove((_method, path) => (path === '/v3/quotations' ? {status: 201, body: quotation} : {status: 402, body: {message: 'ERR_INSUFFICIENT_CREDIT'}}));
    expect(kindOf(await courier.book(request, 'MOTORCYCLE').catch((error: unknown) => error))).toBe('refused');
  });

  it('reads a cancellation Lalamove no longer allows as false', async () => {
    stubLalamove(() => ({status: 409, body: {message: 'ERR_CANCELLATION_FORBIDDEN'}}));
    expect(await lalamoveCourier({key: KEY, secret: SECRET}).cancel('1')).toBe(false);
  });

  it('trusts a webhook only with the right key and signature', async () => {
    const courier = lalamoveCourier({key: KEY, secret: SECRET});
    const data = {order: {orderId: '1234567890123456789', status: 'PICKED_UP'}, updatedAt: '2026-11-25T02:00:00.00Z'};
    const timestamp = 1775027436;
    const signature = await hmacHex(SECRET, signedText(String(timestamp), 'POST', '/api/delivery/callback', JSON.stringify(data)));
    const event = {apiKey: KEY, timestamp, signature, eventType: 'ORDER_STATUS_CHANGED', data};
    expect(await courier.confirm(JSON.stringify(event), '/api/delivery/callback')).toBe('1234567890123456789');
    expect(await courier.confirm(JSON.stringify({...event, signature: 'forged'}), '/api/delivery/callback')).toBeNull();
    expect(await courier.confirm(JSON.stringify({...event, apiKey: 'pk_test_other'}), '/api/delivery/callback')).toBeNull();
    expect(await courier.confirm('', '/api/delivery/callback')).toBeNull();
  });

  it('reads money and errors in both of Lalamove’s shapes', () => {
    expect(toSen('12.5')).toBe(1250);
    expect(toSen(7)).toBe(700);
    expect(Number.isNaN(toSen(undefined))).toBe(true);
    expect(errorId({errors: [{id: 'ERR_X'}]})).toBe('ERR_X');
    expect(errorId({message: 'ERR_Y'})).toBe('ERR_Y');
  });
});
