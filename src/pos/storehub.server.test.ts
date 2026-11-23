import {afterEach, describe, expect, it, vi} from 'vitest';
import type {StorehubTransaction} from './sale';
import {StorehubError, storehubClient} from './storehub.server';

const sale: StorehubTransaction = {
  refId: 'x', invoiceNumber: 'WEB-X', storeId: 's', transactionType: 'Sale', transactionTime: '2026-11-23T00:00:00.000Z', paymentMethod: 'CreditCard',
  total: 9, subTotal: 9, tax: 0, discount: 0, roundedAmount: 0, comment: '', items: [],
};

/** StoreHub answering every call with this status and JSON body; returns the calls made. */
function storehubAnswers(status: number, body: unknown) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(body), {status});
  });
  return calls;
}

const client = () => storehubClient({username: 'shop', token: 'token'});

afterEach(() => vi.unstubAllGlobals());

describe('storehubClient', () => {
  it('counts cancelling a sale StoreHub never had as done', async () => {
    storehubAnswers(404, {code: 'ResourceNotFound', message: "Cannot find a transaction with refId 'x'"});
    await expect(client().cancelSale('x', new Date())).resolves.toBeUndefined();
  });

  it('fails on a 404 that is not StoreHub saying the sale does not exist', async () => {
    storehubAnswers(404, {message: 'no route'});
    await expect(client().cancelSale('x', new Date())).rejects.toMatchObject({status: 404});
  });

  it('never counts a sale as recorded on a 404', async () => {
    storehubAnswers(404, {code: 'ResourceNotFound'});
    await expect(client().recordSale(sale)).rejects.toBeInstanceOf(StorehubError);
  });

  it('reports the status of a refused call, and never calls StoreHub without a token', async () => {
    const calls = storehubAnswers(503, {});
    await expect(client().cancelSale('x', new Date())).rejects.toMatchObject({status: 503, refusedThisSale: false});
    await expect(storehubClient({username: 'shop', token: ''}).cancelSale('x', new Date())).rejects.toMatchObject({status: 401});
    expect(calls).toHaveLength(1);
  });
});
