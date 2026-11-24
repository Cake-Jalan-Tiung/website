import {describe, expect, it} from 'vitest';
import {PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, type PDFObject} from 'pdf-lib';
import {storefront} from '../site/content';
import type {Storefront} from '../storefront/model';
import {receiptFilename, receiptPdf} from './receipt-pdf';
import type {EmailDelivery, EmailOrder} from './email';

const order: EmailOrder = {
  id: 'k3f9qa00-0000-4000-8000-000000000000',
  status: 'paid',
  pickupAt: '2026-11-27T06:15:00.000Z',
  paidAt: '2026-11-27T04:52:00.000Z',
  arrivedAt: null,
  customer: {name: 'Aina Rahman', note: 'Write “Selamat Hari Jadi” on the cake'},
  items: [{dishId: 'croissant', name: 'Croissant', unitSen: 900, quantity: 2}],
  totalSen: 1800,
  delivery: null,
};

/** The ride pinned here, not read from content.ts: 10 minutes to hand over, then 3 a kilometre. */
const store: Storefront = {...storefront, deliveryArea: {from: {lat: 3.08, lng: 101.52}, radiusKm: 10, service: 'MOTORCYCLE', minutesPerKm: 3, handoverMinutes: 10}};
/** 6.24 km at RM 8: collected at 2:15pm, it should arrive 10 + ceil(6.24 × 3) = 29 minutes later, at 2:44pm. */
const ride: EmailDelivery = {address: 'Lot 12 & 14, Jalan Tiung 4/1, Seksyen 4, 40000 Shah Alam', feeSen: 800, distanceM: 6240, state: 'waiting', shareLink: null};
const delivered: EmailOrder = {...order, delivery: ride, totalSen: 1800 + 800};

/** The receipt opened as a PDF; fails the test when none was drawn. */
async function drawn(input: EmailOrder, shop: Storefront = storefront) {
  const bytes = await receiptPdf(input, shop);
  if (!bytes) throw new Error('no PDF drawn');
  return PDFDocument.load(bytes);
}

const read = (stream: PDFObject | undefined) => (stream instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(stream).decode()) : '');
const units = (hex: string) => hex.match(/.{4}/g) ?? [];

/** Every piece of text the receipt prints, in drawing order: subset fonts draw glyph numbers, read back through each font's ToUnicode map. */
function printed(doc: PDFDocument): string[] {
  return doc.getPages().flatMap((page) => {
    const fonts = page.node.Resources()?.lookup(PDFName.of('Font'), PDFDict);
    const maps = new Map(
      (fonts?.entries() ?? []).map(([name, ref]) => {
        const cmap = read(doc.context.lookup(ref, PDFDict).lookup(PDFName.of('ToUnicode')));
        const glyphs = [...cmap.matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/gi)].map(([, glyph, unicode]): [string, string] => [glyph.toUpperCase(), String.fromCharCode(...units(unicode).map((unit) => parseInt(unit, 16)))]);
        return [name.toString(), new Map(glyphs)];
      }),
    );
    const contents = page.node.Contents();
    const operators = (contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents]).map(read).join('\n');
    let glyphs = new Map<string, string>();
    const pieces: string[] = [];
    for (const [, font, shown] of operators.matchAll(/(\/\S+) [\d.]+ Tf|<([0-9A-F]+)> Tj/gi)) {
      if (font) glyphs = maps.get(font) ?? new Map();
      else pieces.push(units(shown).map((glyph) => glyphs.get(glyph.toUpperCase()) ?? '?').join(''));
    }
    return pieces;
  });
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

  it('prints the pick-up time and the shop for an order collected at the counter', async () => {
    const text = printed(await drawn(order));
    expect(text.slice(text.indexOf('CUSTOMER'), text.indexOf('ITEM')).join(' ')).toBe(`CUSTOMER PICK-UP Aina Rahman Fri 27 Nov 2026, 2:15pm ${storefront.address.join(', ')}`);
    const croissant = text.indexOf('Croissant');
    expect(text.slice(croissant, croissant + 6)).toEqual(['Croissant', '2', '9.00', '18.00', 'Total paid', 'RM 18.00']);
  }, 20000);

  it('prints a delivery’s arrival and street where pick-up goes, and its ride as a row that makes the total', async () => {
    const doc = await drawn(delivered, store);
    expect(doc.getPageCount()).toBe(1);
    const text = printed(doc);
    expect(text.slice(text.indexOf('CUSTOMER'), text.indexOf('ITEM')).join(' ')).toBe('CUSTOMER ARRIVES ABOUT Aina Rahman Fri 27 Nov 2026, 2:44pm Delivered to Lot 12 & 14, Jalan Tiung 4/1, Seksyen 4, 40000 Shah Alam');
    // Croissant 2 × 9.00 = 18.00, the ride 8.00, together the 26.00 paid.
    const croissant = text.indexOf('Croissant');
    expect(text.slice(croissant, croissant + 10)).toEqual(['Croissant', '2', '9.00', '18.00', 'Delivery · 6.2 km', '1', '8.00', '8.00', 'Total paid', 'RM 26.00']);
  }, 20000);

  it('draws no PDF for a street its fonts cannot print', async () => {
    expect(await receiptPdf({...delivered, delivery: {...ride, address: '雪兰莪州莎阿南 4 区'}}, store)).toBeNull();
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
