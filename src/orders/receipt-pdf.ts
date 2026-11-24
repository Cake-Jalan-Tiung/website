// The receipt as a PDF, attached to the receipt email: the paper a customer keeps or claims as
// an expense. A5, so it prints whole on A4. Drawn in the brand: the lockup on a cream band, Jost
// for words and Paper Mono for what a till prints (the code, times and money). A long order runs
// on to further pages under the same table head.
import fontkit from '@pdf-lib/fontkit';
import {PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage} from 'pdf-lib';
import {color, type ColorName} from '../system/tokens';
import {formatShopRecord} from '../storefront/hours';
import type {Storefront} from '../storefront/model';
import {orderCode} from './model';
import type {EmailOrder} from './email';
// Static TrueType cuts, licences beside them in assets/fonts/: fontkit draws Jost's variable font
// blank once subset, and hangs subsetting Paper Mono's WOFF2.
import jostUrl from '../../assets/fonts/Jost-400-Book.ttf?inline';
import jostMediumUrl from '../../assets/fonts/Jost-500-Medium.ttf?inline';
import monoUrl from '../../assets/fonts/PaperMono-Regular.ttf?inline';
import monoMediumUrl from '../../assets/fonts/PaperMono-Medium.ttf?inline';
import lockupUrl from '../../public/email/lockup.png?inline';
import iconUrl from '../../public/email/tiung-icon.png?inline';

/** The bytes of an asset the bundler inlined as a data URL, decoded once per isolate. */
const decoded = new Map<string, Uint8Array>();
const bytes = (dataUrl: string) => {
  let value = decoded.get(dataUrl);
  if (!value) {
    value = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (char) => char.charCodeAt(0));
    decoded.set(dataUrl, value);
  }
  return value;
};

const ink = (name: ColorName) => {
  const hex = color[name].slice(1);
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
};

/** A5 in points, its margin, and the band the lockup sits on. */
const PAGE = {width: 419.53, height: 595.28} as const;
const M = 32;
const BAND = 124;
/** Where the sign-off's hairline sits on the last page. */
const FOOTER_TOP = M + 54;
const RULE = 1.5;
const HAIRLINE = 0.5;

type Fonts = {sans: PDFFont; sansMedium: PDFFont; mono: PDFFont; monoMedium: PDFFont};

/** A word wider than `width` cut into pieces that fit, so a pasted link cannot run off the page. */
function pieces(word: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  let piece = '';
  for (const char of word) {
    if (piece && font.widthOfTextAtSize(piece + char, size) > width) {
      out.push(piece);
      piece = char;
    } else piece += char;
  }
  return piece ? [...out, piece] : out;
}

/** Lines of `text` that fit `width` at `size`, broken between words, and inside a word too wide for a line. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean).flatMap((word) => pieces(word, font, size, width))) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  return line ? [...lines, line] : lines;
}

export const receiptFilename = (orderId: string) => `Receipt-${orderCode(orderId)}.pdf`;

/**
 * The receipt for a paid order, or null when the customer's words use characters these fonts do not
 * have (Chinese, Tamil, emoji): the HTML email shows them, a PDF would print empty boxes. Throws only
 * if the PDF cannot be drawn; the email goes without it either way.
 */
export async function receiptPdf(order: EmailOrder, store: Storefront): Promise<Uint8Array | null> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    sans: await doc.embedFont(bytes(jostUrl), {subset: true}),
    sansMedium: await doc.embedFont(bytes(jostMediumUrl), {subset: true}),
    mono: await doc.embedFont(bytes(monoUrl), {subset: true}),
    monoMedium: await doc.embedFont(bytes(monoMediumUrl), {subset: true}),
  };
  const drawable = (font: PDFFont, text: string) => {
    const known = new Set(font.getCharacterSet());
    return [...text.replace(/\s+/g, '')].every((char) => known.has(char.codePointAt(0) ?? -1));
  };
  if (!drawable(fonts.sansMedium, order.customer.name) || !drawable(fonts.sans, order.customer.note)) return null;
  const lockup = await doc.embedPng(bytes(lockupUrl));
  const icon = await doc.embedPng(bytes(iconUrl));
  const code = orderCode(order.id);
  const paidAt = order.paidAt ?? order.pickupAt;

  doc.setTitle(`Receipt ${code} · ${store.name}`);
  doc.setAuthor(store.legalName ?? store.name);
  doc.setSubject(`Receipt for order ${code}`);
  doc.setCreator(store.name);
  doc.setProducer(store.name);
  doc.setCreationDate(new Date(paidAt));
  doc.setModificationDate(new Date(paidAt));

  const right = PAGE.width - M;
  const inner = right - M;
  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = 0;

  const text = (value: string, x: number, at: number, font: PDFFont, size: number, name: ColorName = 'ink') => page.drawText(value, {x, y: at, font, size, color: ink(name)});
  const textRight = (value: string, x: number, at: number, font: PDFFont, size: number, name: ColorName = 'ink') =>
    text(value, x - font.widthOfTextAtSize(value, size), at, font, size, name);
  const label = (value: string, x: number, at: number) => text(value.toUpperCase(), x, at, fonts.mono, 7, 'muted');
  const labelRight = (value: string, x: number, at: number) => textRight(value.toUpperCase(), x, at, fonts.mono, 7, 'muted');
  const rule = (at: number, thickness: number, name: ColorName = 'ink') =>
    page.drawLine({start: {x: M, y: at}, end: {x: right, y: at}, thickness, color: ink(name)});
  const image = (art: PDFImage, width: number, x: number, top: number) => {
    const height = (art.height / art.width) * width;
    page.drawImage(art, {x, y: top - height, width, height});
  };

  // Columns of the item table: the dish takes what the figures leave.
  const columns = {amount: right, unit: right - 78, qty: right - 140};
  const dishWidth = columns.qty - 22 - M;
  const tableHead = () => {
    label('Item', M, y);
    labelRight('Qty', columns.qty, y);
    labelRight('Unit (RM)', columns.unit, y);
    labelRight('Amount (RM)', columns.amount, y);
    y -= 10;
    rule(y, HAIRLINE, 'rule');
    y -= 15;
  };
  /** A further page; the table head again when items continue on it. */
  const nextPage = (withTable: boolean) => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - M;
    label(`Receipt ${code}, continued`, M, y);
    y -= 24;
    if (withTable) tableHead();
  };
  /** Whether `height` more fits above the bottom margin. */
  const fits = (height: number) => y - height >= M;

  // The band, the lockup at the brand's smallest crowned size in print terms.
  page.drawRectangle({x: 0, y: PAGE.height - BAND, width: PAGE.width, height: BAND, color: ink('cream-100')});
  image(lockup, 150, (PAGE.width - 150) / 2, PAGE.height - (BAND - (lockup.height / lockup.width) * 150) / 2);

  y = PAGE.height - BAND - 30;
  label('Receipt', M, y);
  labelRight(store.legalName ?? store.name, right, y);
  y -= 30;
  text(code, M, y, fonts.monoMedium, 26);
  y -= 18;
  text(`Paid ${formatShopRecord(store.timeZone, paidAt)}`, M, y, fonts.mono, 8.5, 'muted');

  // Who and when.
  y -= 22;
  rule(y, RULE);
  y -= 16;
  const half = M + inner / 2 + 8;
  label('Customer', M, y);
  label('Pick-up', half, y);
  y -= 15;
  const nameLines = wrap(order.customer.name.trim(), fonts.sansMedium, 10.5, half - M - 16);
  nameLines.forEach((line, index) => text(line, M, y - index * 14, fonts.sansMedium, 10.5));
  text(formatShopRecord(store.timeZone, order.pickupAt), half, y, fonts.mono, 9.5);
  const addressLines = wrap(store.address.join(', '), fonts.sans, 8.5, right - half);
  addressLines.forEach((line, index) => text(line, half, y - 14 - index * 11.5, fonts.sans, 8.5, 'muted'));
  y -= Math.max(nameLines.length * 14, 14 + addressLines.length * 11.5) + 14;

  // What was bought.
  rule(y, RULE);
  y -= 16;
  tableHead();
  for (const line of order.items) {
    const lines = wrap(line.name, fonts.sans, 10, dishWidth);
    const extra = (lines.length - 1) * 13;
    if (!fits(extra + 23)) nextPage(true);
    lines.forEach((part, index) => text(part, M, y - index * 13, fonts.sans, 10));
    textRight(String(line.quantity), columns.qty, y, fonts.mono, 9.5);
    textRight((line.unitSen / 100).toFixed(2), columns.unit, y, fonts.mono, 9.5);
    textRight(((line.unitSen * line.quantity) / 100).toFixed(2), columns.amount, y, fonts.mono, 9.5);
    y -= extra + 8;
    rule(y, HAIRLINE, 'rule');
    y -= 15;
  }
  // The sign-off is kept with what ends the receipt, never left alone on a page.
  const signOff = FOOTER_TOP - M + 16;
  const note = order.customer.note.trim();
  if (!fits(30 + (note ? 0 : signOff))) nextPage(false);
  y -= 6;
  text('Total paid', M, y, fonts.sansMedium, 11);
  textRight(`RM ${(order.totalSen / 100).toFixed(2)}`, right, y - 1, fonts.monoMedium, 16);

  // The customer's note, as the kitchen received it.
  if (note) {
    const noteLines = wrap(note, fonts.sans, 9.5, inner - 24);
    const height = 30 + noteLines.length * 13;
    y -= 22;
    if (!fits(height + signOff)) nextPage(false);
    page.drawRectangle({x: M, y: y - height, width: inner, height, color: ink('cream-100')});
    label('Your note', M + 12, y - 16);
    noteLines.forEach((line, index) => text(line, M + 12, y - 31 - index * 13, fonts.sans, 9.5));
    y -= height;
  }

  // The sign-off, at the foot of the last page; on a page of its own only if nothing left room.
  const footerTop = FOOTER_TOP;
  if (y - 16 < footerTop) nextPage(false);
  page.drawLine({start: {x: M, y: footerTop}, end: {x: right, y: footerTop}, thickness: HAIRLINE, color: ink('rule')});
  image(icon, 18, M, footerTop - 14);
  const textX = M + 28;
  text(store.signOff, textX, footerTop - 22, fonts.sans, 9);
  text(`${store.address.join(', ')} · ${store.phone.display}`, textX, footerTop - 35, fonts.sans, 7.5, 'muted');

  return doc.save();
}
