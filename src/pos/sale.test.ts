import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import {storehub} from '../site/pos';
import {dishIndex} from '../storefront/model';
import {storehubTransaction, type PosSale} from './sale';

const shop = {storeId: storehub.storeId, paymentMethod: storehub.paymentMethod, products: storehub.products, timeZone: storefront.timeZone};

const sale: PosSale = {
  orderId: '0f9a2c51-7d3e-4b8a-9e61-3c5d7a2b8e40',
  paidAt: '2026-11-23T10:16:02.303Z',
  pickupAt: '2026-11-24T00:00:00.000Z',
  paymentMethod: 'fpx',
  totalSen: 900 + 2 * 1950,
  items: [
    {dishId: 'croissant', name: 'Croissant', unitSen: 900, quantity: 1},
    {dishId: 'iced-ajisai-matcha-latte', name: 'Iced Ajisai 2.0 Matcha Latte', unitSen: 1950, quantity: 2},
  ],
};

describe('storehubTransaction', () => {
  it('records what the customer paid, in ringgit, against the StoreHub products', () => {
    const transaction = storehubTransaction(sale, shop);
    expect(transaction).toMatchObject({
      refId: sale.orderId,
      invoiceNumber: 'WEB-0F9A2C',
      storeId: '560ce27f0ce34105ab775d52',
      transactionType: 'Sale',
      transactionTime: sale.paidAt,
      paymentMethod: 'CreditCard',
      total: 48,
      subTotal: 48,
      discount: 0,
    });
    expect(transaction.items).toEqual([
      {productId: '602b358b83bf530006d0e546', quantity: 1, unitPrice: 9, subTotal: 9, total: 9, tax: 0, discount: 0},
      {productId: '683fe999d7c0ce00083fcfe5', quantity: 2, unitPrice: 19.5, subTotal: 39, total: 39, tax: 0, discount: 0},
    ]);
    // Every web sale has one StoreHub payment method, so the real method and the pick-up time go in the
    // comment, with the date written out: "Tomorrow" means nothing in a report read next month.
    expect(transaction.comment).toBe('Web order 0F9A2C, paid online (fpx), pick-up Tue 24 Nov, 8am');
  });

  it('records a delivery’s food alone, and names the ride’s fee in the comment', () => {
    const transaction = storehubTransaction({...sale, deliverySen: 800}, shop);
    expect(transaction).toMatchObject({total: 48, subTotal: 48});
    expect(transaction.items.map((item) => item.productId)).toEqual(['602b358b83bf530006d0e546', '683fe999d7c0ce00083fcfe5']);
    expect(transaction.comment).toBe('Web order 0F9A2C, paid online (fpx), delivery collected Tue 24 Nov, 8am; the customer also paid RM\u00a08.00 for the ride, which is not in this sale');
  });

  it('records a pick-up as before when it has no ride', () => {
    expect(storehubTransaction({...sale, deliverySen: null}, shop).comment).toBe('Web order 0F9A2C, paid online (fpx), pick-up Tue 24 Nov, 8am');
  });

  it('records under the payment method the shop names', () => {
    expect(storehubTransaction(sale, {...shop, paymentMethod: 'Website'}).paymentMethod).toBe('Website');
  });

  it('refuses a sale whose lines are missing or do not make what was paid', () => {
    expect(() => storehubTransaction({...sale, items: []}, shop)).toThrow(/0 lines/);
    expect(() => storehubTransaction({...sale, totalSen: sale.totalSen + 1}, shop)).toThrow(/not the/);
  });

  it('refuses a dish with no StoreHub product rather than record a wrong sale', () => {
    expect(() => storehubTransaction({...sale, totalSen: 100, items: [{dishId: 'not-mapped', name: 'X', unitSen: 100, quantity: 1}]}, shop)).toThrow(/not-mapped/);
  });
});

describe('StoreHub products', () => {
  it('covers every dish on the menu, and nothing that is not on it', () => {
    const menu = [...dishIndex(storefront).keys()].sort();
    expect(Object.keys(storehub.products).sort()).toEqual(menu);
  });

  it('maps no two dishes to one product', () => {
    const ids = Object.values(storehub.products);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
