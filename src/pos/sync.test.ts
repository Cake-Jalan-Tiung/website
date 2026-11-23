import {describe, expect, it} from 'vitest';
import type {Alert} from '../ops/alert.server';
import {storefront} from '../site/content';
import {storehub} from '../site/pos';
import type {PosSale, StorehubTransaction} from './sale';
import {StorehubError, type StorehubClient} from './storehub.server';
import {syncPos, type PosLedger} from './sync';

const shop = {storeId: storehub.storeId, paymentMethod: storehub.paymentMethod, products: storehub.products, timeZone: storefront.timeZone};
const now = new Date('2026-11-23T10:00:00.000Z');

const sale = (orderId: string, dishId = 'croissant'): PosSale => ({
  orderId,
  paidAt: '2026-11-23T09:00:00.000Z',
  pickupAt: '2026-11-23T10:00:00.000Z',
  paymentMethod: 'fpx',
  totalSen: 900,
  items: [{dishId, name: 'Croissant', unitSen: 900, quantity: 1}],
});

/** An order store holding unrecorded sales and refunded ids, marking what the sweep finishes. */
function ledger(unrecorded: PosSale[], uncancelled: string[] = []) {
  const marked: string[] = [];
  const store: PosLedger = {
    posUnrecorded: async (limit) => unrecorded.slice(0, limit),
    posUncancelled: async (limit) => uncancelled.slice(0, limit),
    markPos: async (id, step) => void marked.push(`${step} ${id}`),
  };
  return {store, marked};
}

/** StoreHub answering each call with the given outcome, in order; it records every call made. */
function storehubAnswering(...outcomes: (StorehubError | Error | 'ok')[]) {
  const calls: string[] = [];
  const answer = async (call: string) => {
    calls.push(call);
    const outcome = outcomes.shift() ?? 'ok';
    if (outcome !== 'ok') throw outcome;
  };
  const client: StorehubClient = {
    recordSale: (transaction: StorehubTransaction) => answer(`record ${transaction.refId}`),
    cancelSale: (refId: string) => answer(`cancel ${refId}`),
  };
  return {client, calls};
}

async function sweep(store: PosLedger, client: StorehubClient) {
  const alerts: Alert[] = [];
  await syncPos({ledger: store, pos: client, shop, alert: async (alert) => void alerts.push(alert), now: () => now, pause: async () => {}});
  return alerts;
}

describe('syncPos', () => {
  it('records each sale, cancels each refund, and marks both done', async () => {
    const {store, marked} = ledger([sale('a'), sale('b')], ['r']);
    const {client, calls} = storehubAnswering();
    const alerts = await sweep(store, client);
    expect(calls).toEqual(['record a', 'record b', 'cancel r']);
    expect(marked).toEqual(['recorded a', 'recorded b', 'cancelled r']);
    expect(alerts).toEqual([]);
  });

  it('leaves a refused sale unmarked, alerts about that order, and carries on with the rest', async () => {
    const {store, marked} = ledger([sale('a'), sale('b')], ['r']);
    const {client, calls} = storehubAnswering(new StorehubError(400, 'bad item'));
    const alerts = await sweep(store, client);
    expect(calls).toEqual(['record a', 'record b', 'cancel r']);
    expect(marked).toEqual(['recorded b', 'cancelled r']);
    expect(alerts.map((a) => a.key)).toEqual(['storehub-record:a']);
  });

  it('alerts separately for each refused sale, so a second problem is not hidden behind the first', async () => {
    const {store} = ledger([sale('a'), sale('b')]);
    const {client} = storehubAnswering(new StorehubError(400, 'x'), new StorehubError(422, 'y'));
    expect((await sweep(store, client)).map((a) => a.key)).toEqual(['storehub-record:a', 'storehub-record:b']);
  });

  it('refuses a dish with no StoreHub product without calling StoreHub, and carries on', async () => {
    const {store, marked} = ledger([sale('a', 'not-mapped'), sale('b')]);
    const {client, calls} = storehubAnswering();
    const alerts = await sweep(store, client);
    expect(calls).toEqual(['record b']);
    expect(marked).toEqual(['recorded b']);
    expect(alerts[0].body).toMatch(/not-mapped/);
  });

  it.each([
    ['a wrong token', new StorehubError(401, 'Unauthorized'), 'storehub-auth'],
    ['a missing token', new StorehubError(401, 'STOREHUB_API_TOKEN is not set on the Worker'), 'storehub-auth'],
    ['a rate limit', new StorehubError(429, 'Too Many Requests'), 'storehub-unavailable'],
    ['StoreHub down', new StorehubError(503, 'Service Unavailable'), 'storehub-unavailable'],
    ['no answer', new StorehubError(null, 'timed out'), 'storehub-unavailable'],
  ])('stops the run after one call on %s, marking nothing', async (_, error, key) => {
    const {store, marked} = ledger([sale('a'), sale('b')], ['r']);
    const {client, calls} = storehubAnswering(error);
    const alerts = await sweep(store, client);
    expect(calls).toEqual(['record a']);
    expect(marked).toEqual([]);
    expect(alerts.map((a) => a.key)).toEqual([key]);
  });

  it('keeps a failed cancel for the next run and says the sale still counts', async () => {
    const {store, marked} = ledger([], ['r']);
    const {client} = storehubAnswering(new StorehubError(400, 'bad cancelledTime'));
    const alerts = await sweep(store, client);
    expect(marked).toEqual([]);
    expect(alerts[0]).toMatchObject({key: 'storehub-cancel:r'});
    expect(alerts[0].body).toMatch(/still counts the sale/);
  });
});

describe('syncPos after StoreHub accepts', () => {
  it('does not report a failure to mark the order as StoreHub refusing the sale', async () => {
    const {store} = ledger([sale('a')]);
    store.markPos = async () => {
      throw new Error('D1 unavailable');
    };
    const {client} = storehubAnswering();
    const alerts: Alert[] = [];
    await expect(syncPos({ledger: store, pos: client, shop, alert: async (alert) => void alerts.push(alert), now: () => now, pause: async () => {}})).rejects.toThrow('D1 unavailable');
    expect(alerts).toEqual([]);
  });
});
