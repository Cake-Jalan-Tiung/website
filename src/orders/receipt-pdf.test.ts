import {describe, expect, it} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {storefront} from '../site/content';
import {receiptFilename, receiptPdf} from './receipt-pdf';
import type {EmailOrder} from './email';

const order: EmailOrder = {
  id: 'k3f9qa00-0000-4000-8000-000000000000',
  status: 'paid',
  pickupAt: '2026-11-27T06:15:00.000Z',
  paidAt: '2026-11-27T04:52:00.000Z',
  arrivedAt: null,
  customer: {name: 'Aina Rahman', note: 'Write “Selamat Hari Jadi” on the cake'},
  items: [{dishId: 'croissant', name: 'Croissant', unitSen: 900, quantity: 2}],
  totalSen: 1800,
};

/** The receipt opened as a PDF; fails the test when none was drawn. */
async function drawn(input: EmailOrder) {
  const bytes = await receiptPdf(input, storefront);
  if (!bytes) throw new Error('no PDF drawn');
  return PDFDocument.load(bytes);
}

describe('receiptPdf', () => {
  it('is one A5 page for an ordinary order, named and dated as the receipt', async () => {
    const doc = await drawn(order);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({width: 419.53, height: 595.28});
    expect(doc.getTitle()).toBe('Receipt K3F9QA · Cake Jalan Tiung');
    expect(doc.getAuthor()).toBe('CJT Bakery Sdn. Bhd.');
    expect(doc.getCreationDate()?.toISOString()).toBe('2026-11-27T04:52:00.000Z');
    expect(receiptFilename(order.id)).toBe('Receipt-K3F9QA.pdf');
  }, 20000);

  it('runs a long order on to further pages', async () => {
    const items = Array.from({length: 40}, (_, index) => ({dishId: `d${index}`, name: `Dish ${index}`, unitSen: 1000, quantity: 1}));
    const doc = await drawn({...order, items, totalSen: 40_000});
    expect(doc.getPageCount()).toBeGreaterThan(1);
  }, 20000);

  it('draws no PDF for words its fonts cannot print, rather than empty boxes', async () => {
    expect(await receiptPdf({...order, customer: {name: '陈美玲', note: ''}}, storefront)).toBeNull();
    expect(await receiptPdf({...order, customer: {name: 'Aina', note: 'Happy birthday 🎂'}}, storefront)).toBeNull();
  }, 20000);

  it('still draws one page when a note holds a word wider than its box', async () => {
    const doc = await drawn({...order, customer: {name: 'Aina', note: 'https://example.com/a-very-long-link-to-the-cake-design-reference-image-that-has-no-spaces'}});
    expect(doc.getPageCount()).toBe(1);
  }, 20000);
});
